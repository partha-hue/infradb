#pragma once

#include <atomic>
#include <cstddef>
#include <type_traits>

namespace infradb::concurrency
{

        // Lock-free SPSC queue specialized for single-producer, single-consumer workloads.
        // The queue is sized to a power-of-two and uses a mask for fast index wrapping.
        // alignas(64) avoids false sharing between head and tail counters on separate cache lines.
        template <typename T, std::size_t Capacity>
        class LockFreeQueue
        {
                static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be a power of two.");
                static_assert(std::is_nothrow_copy_assignable_v<T> || std::is_nothrow_move_assignable_v<T>,
                              "T must be nothrow assignable for lock-free queue semantics.");

        public:
                LockFreeQueue() noexcept : head_(0), tail_(0) {}

                LockFreeQueue(const LockFreeQueue &) = delete;
                LockFreeQueue &operator=(const LockFreeQueue &) = delete;

                bool enqueue(const T &value) noexcept
                {
                        const std::size_t tail = tail_.load(std::memory_order_relaxed);
                        const std::size_t next_tail = (tail + 1u) & mask_;
                        if (next_tail == head_.load(std::memory_order_acquire))
                        {
                                return false; // queue is full
                        }
                        buffer_[tail] = value;
                        tail_.store(next_tail, std::memory_order_release);
                        return true;
                }

                bool enqueue(T &&value) noexcept
                {
                        const std::size_t tail = tail_.load(std::memory_order_relaxed);
                        const std::size_t next_tail = (tail + 1u) & mask_;
                        if (next_tail == head_.load(std::memory_order_acquire))
                        {
                                return false;
                        }
                        buffer_[tail] = std::move(value);
                        tail_.store(next_tail, std::memory_order_release);
                        return true;
                }

                bool try_dequeue(T &out) noexcept
                {
                        const std::size_t head = head_.load(std::memory_order_relaxed);
                        if (head == tail_.load(std::memory_order_acquire))
                        {
                                return false; // queue is empty
                        }
                        out = buffer_[head];
                        head_.store((head + 1u) & mask_, std::memory_order_release);
                        return true;
                }

                bool empty() const noexcept
                {
                        return head_.load(std::memory_order_acquire) == tail_.load(std::memory_order_acquire);
                }

                static constexpr std::size_t capacity() noexcept
                {
                        return Capacity - 1u;
                }

        private:
                static constexpr std::size_t mask_ = Capacity - 1u;
                alignas(64) std::atomic<std::size_t> head_;
                alignas(64) std::atomic<std::size_t> tail_;
                alignas(64) T buffer_[Capacity];
        };

} // namespace infradb::concurrency
