#pragma once
#include <vector>
#include <thread>
#include <functional>
#include <future>
#include <atomic>
#include "RingBuffer.hpp"

namespace infradb::concurrency {

/**
 * TaskScheduler: A low-latency thread pool that uses spin-waiting 
 * instead of mutexes to pick up tasks from the SPSC RingBuffer.
 */
class TaskScheduler {
public:
    static TaskScheduler& instance() {
        static TaskScheduler inst(std::thread::hardware_concurrency());
        return inst;
    }

    template<typename F>
    auto async_dispatch(F&& f) -> std::future<typename std::invoke_result<F>::type> {
        using return_type = typename std::invoke_result<F>::type;
        auto task = std::make_shared<std::packaged_task<return_type()>>(std::forward<F>(f));
        auto res = task->get_future();
        
        // Push task to an internal lock-free queue
        if (!tasks_.push([task]() { (*task)(); })) {
            throw std::runtime_error("Task queue is full");
        }
        return res;
    }

    void shutdown() {
        stop_ = true;
        for (auto& worker : workers_) {
            if (worker.joinable()) worker.join();
        }
    }

private:
    explicit TaskScheduler(size_t thread_count) : tasks_(1024) {
        for (size_t i = 0; i < thread_count; ++i) {
            workers_.emplace_back([this, i]() {
                // Pin thread logic would go here for Linux (pthread_setaffinity_np)
                while (!stop_) {
                    std::function<void()> task;
                    if (tasks_.pop(task)) {
                        task();
                    } else {
                        // Low-latency yield instead of sleep/mutex wait
                        std::this_thread::yield();
                    }
                }
            });
        }
    }

    ~TaskScheduler() {
        shutdown();
    }

    std::vector<std::thread> workers_;
    SPSCRingBuffer<std::function<void()>> tasks_;
    std::atomic<bool> stop_{false};
};

} // namespace infradb::concurrency
