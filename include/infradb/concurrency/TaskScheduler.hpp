#pragma once
#include <atomic>
#include <cstdlib>
#include <condition_variable>
#include <cstddef>
#include <deque>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string_view>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>
#if defined(__linux__)
#include <pthread.h>
#include <sched.h>
#endif

namespace infradb::concurrency {

/**
 * TaskScheduler: bounded MPMC thread pool with low overhead wakeups.
 */
class TaskScheduler {
public:
    static TaskScheduler& instance() {
        static TaskScheduler inst(default_thread_count());
        return inst;
    }

    template <typename F>
    auto async_dispatch(F&& f) -> std::future<std::invoke_result_t<F>> {
        using return_type = std::invoke_result_t<F>;
        auto task = std::make_shared<std::packaged_task<return_type()>>(std::forward<F>(f));
        auto res = task->get_future();
        const size_t node = pick_node_for_submit();

        for (;;) {
            if (!accepting_.load(std::memory_order_acquire)) {
                throw std::runtime_error("TaskScheduler is shut down");
            }

            if (try_enqueue(node, [task]() { (*task)(); })) {
                break;
            }

            std::unique_lock<std::mutex> lock(wait_mutex_);
            queue_not_full_cv_.wait(lock, [this]() {
                return !accepting_.load(std::memory_order_acquire) || has_queue_capacity();
            });
        }

        queue_not_empty_cv_.notify_all();
        return res;
    }

    void shutdown() {
        bool expected = true;
        if (!accepting_.compare_exchange_strong(expected, false, std::memory_order_acq_rel)) {
            return;
        }

        stop_.store(true, std::memory_order_release);

        queue_not_empty_cv_.notify_all();
        queue_not_full_cv_.notify_all();

        for (auto& worker : workers_) {
            if (worker.joinable()) {
                worker.join();
            }
        }
        workers_.clear();
    }

private:
    struct NodeQueue {
        std::mutex mutex;
        std::deque<std::function<void()>> tasks;
        size_t capacity{0};
    };

    explicit TaskScheduler(size_t thread_count, size_t queue_capacity = 8192) {
        const bool numa_aware = env_bool("INFRA_NUMA_AWARE", true);
        pin_threads_ = env_bool("INFRA_PIN_THREADS", true);
        node_count_ = numa_aware ? detect_numa_nodes() : 1;
        if (node_count_ == 0) {
            node_count_ = 1;
        }
        if (node_count_ > thread_count) {
            node_count_ = thread_count;
        }

        node_queues_.reserve(node_count_);
        const size_t per_node_capacity = (queue_capacity + node_count_ - 1) / node_count_;
        for (size_t i = 0; i < node_count_; ++i) {
            auto q = std::make_unique<NodeQueue>();
            q->capacity = per_node_capacity == 0 ? 1 : per_node_capacity;
            node_queues_.emplace_back(std::move(q));
        }

        workers_.reserve(thread_count);
        for (size_t i = 0; i < thread_count; ++i) {
            const size_t node = i % node_count_;
            const size_t local_rank = i / node_count_;
            workers_.emplace_back([this, i, node, local_rank]() { worker_loop(i, node, local_rank); });
        }
    }

    ~TaskScheduler() {
        shutdown();
    }

    static size_t default_thread_count() {
        const auto hw = std::thread::hardware_concurrency();
        return hw == 0 ? 1 : static_cast<size_t>(hw);
    }

    static bool env_bool(const char* name, bool default_value) {
        const char* v = std::getenv(name);
        if (v == nullptr) {
            return default_value;
        }
        const std::string_view sv(v);
        return !(sv == "0" || sv == "false" || sv == "False" || sv == "FALSE" || sv == "off" || sv == "OFF");
    }

    static size_t detect_numa_nodes() {
        const char* env = std::getenv("INFRA_NUMA_NODES");
        if (env != nullptr) {
            char* end = nullptr;
            const long long parsed = std::strtoll(env, &end, 10);
            if (end != env && parsed > 0) {
                return static_cast<size_t>(parsed);
            }
        }
        return 1;
    }

    size_t pick_node_for_submit() noexcept {
        return submit_rr_.fetch_add(1, std::memory_order_relaxed) % node_count_;
    }

    bool has_queue_capacity() {
        for (auto& q_ptr : node_queues_) {
            auto& q = *q_ptr;
            std::lock_guard<std::mutex> lock(q.mutex);
            if (q.tasks.size() < q.capacity) {
                return true;
            }
        }
        return false;
    }

    bool try_enqueue(size_t preferred_node, std::function<void()> task) {
        for (size_t step = 0; step < node_count_; ++step) {
            const size_t idx = (preferred_node + step) % node_count_;
            auto& q = *node_queues_[idx];
            std::lock_guard<std::mutex> lock(q.mutex);
            if (q.tasks.size() < q.capacity) {
                q.tasks.emplace_back(std::move(task));
                task_count_.fetch_add(1, std::memory_order_release);
                return true;
            }
        }
        return false;
    }

    bool try_pop_from_node(size_t node, std::function<void()>& out) {
        auto& q = *node_queues_[node];
        std::lock_guard<std::mutex> lock(q.mutex);
        if (q.tasks.empty()) {
            return false;
        }

        out = std::move(q.tasks.front());
        q.tasks.pop_front();
        task_count_.fetch_sub(1, std::memory_order_release);
        return true;
    }

    void maybe_pin_thread(size_t worker_index, size_t node, size_t local_rank) noexcept {
        if (!pin_threads_) {
            return;
        }
        const size_t hw = default_thread_count();
        if (hw == 0) {
            return;
        }

        const size_t cpus_per_node = (hw + node_count_ - 1) / node_count_;
        const size_t cpu_index = (node * cpus_per_node + (local_rank % cpus_per_node)) % hw;

#if defined(_WIN32)
        (void)cpu_index;
#elif defined(__linux__)
        cpu_set_t cpuset;
        CPU_ZERO(&cpuset);
        CPU_SET(static_cast<int>(cpu_index), &cpuset);
        (void)pthread_setaffinity_np(pthread_self(), sizeof(cpu_set_t), &cpuset);
#else
        (void)worker_index;
#endif
    }

    void worker_loop(size_t worker_index, size_t node, size_t local_rank) {
        maybe_pin_thread(worker_index, node, local_rank);

        for (;;) {
            std::function<void()> task;

            if (!try_pop_from_node(node, task)) {
                for (size_t step = 1; step < node_count_; ++step) {
                    const size_t other = (node + step) % node_count_;
                    if (try_pop_from_node(other, task)) {
                        break;
                    }
                }
            }

            if (!task) {
                if (stop_.load(std::memory_order_acquire) && task_count_.load(std::memory_order_acquire) == 0) {
                    return;
                }

                std::unique_lock<std::mutex> wait_lock(wait_mutex_);
                queue_not_empty_cv_.wait(wait_lock, [this]() {
                    return stop_.load(std::memory_order_acquire) || task_count_.load(std::memory_order_acquire) > 0;
                });
                continue;
            }

            queue_not_full_cv_.notify_one();
            task();
        }
    }

    std::vector<std::thread> workers_;
    std::vector<std::unique_ptr<NodeQueue>> node_queues_;
    size_t node_count_{1};
    bool pin_threads_{false};
    std::atomic<size_t> submit_rr_{0};
    std::atomic<size_t> task_count_{0};
    std::mutex wait_mutex_;
    std::condition_variable queue_not_empty_cv_;
    std::condition_variable queue_not_full_cv_;
    std::atomic<bool> stop_{false};
    std::atomic<bool> accepting_{true};
};

} // namespace infradb::concurrency
