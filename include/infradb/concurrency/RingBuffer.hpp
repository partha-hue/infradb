#pragma once
#include <atomic>
#include <vector>
#include <new> 

namespace infradb::concurrency {

// Prevent False Sharing by aligning to cache line size (typically 64 bytes)
#ifdef __cpp_lib_hardware_interference_size
    using std::hardware_destructive_interference_size;
#else
    constexpr size_t hardware_destructive_interference_size = 64;
#endif

/**
 * SPSCRingBuffer: Lock-free Single Producer Single Consumer queue.
 * Optimized for low-latency task passing between Python and C++ threads.
 */
template<typename T>
class SPSCRingBuffer {
public:
    explicit SPSCRingBuffer(size_t capacity) 
        : capacity_(capacity), buffer_(capacity) {}

    bool push(const T& item) {
        const size_t current_tail = tail_.load(std::memory_order_relaxed);
        const size_t next_tail = (current_tail + 1) % capacity_;
        if (next_tail == head_.load(std::memory_order_acquire)) {
            return false; // Full
        }
        buffer_[current_tail] = item;
        tail_.store(next_tail, std::memory_order_release);
        return true;
    }

    bool pop(T& item) {
        const size_t current_head = head_.load(std::memory_order_relaxed);
        if (current_head == tail_.load(std::memory_order_acquire)) {
            return false; // Empty
        }
        item = buffer_[current_head];
        head_.store((current_head + 1) % capacity_, std::memory_order_release);
        return true;
    }

private:
    size_t capacity_;
    std::vector<T> buffer_;

    // Align indices to separate cache lines to avoid cache coherency traffic (false sharing)
    alignas(hardware_destructive_interference_size) std::atomic<size_t> head_{0};
    alignas(hardware_destructive_interference_size) std::atomic<size_t> tail_{0};
};

} // namespace infradb::concurrency
