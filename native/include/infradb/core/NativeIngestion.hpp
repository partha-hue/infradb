#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <string>
#include <thread>
#include <vector>
#include <memory>
#include "infradb/concurrency/LockFreeQueue.hpp"

#ifdef _WIN32
#include <windows.h>
#endif

namespace infradb::core
{

        // A single ingestion record aligned to 64 bytes to avoid false sharing
        // between producer and consumer threads on adjacent cache lines.
        struct alignas(64) IngestRecord
        {
                char symbol[16];   // compact symbol payload
                double price;      // price value used for analytics
                int32_t volume;    // quantity or volume
                int64_t timestamp; // epoch time in seconds
                char padding[24];  // pad to 64 bytes
        };

        class MemoryMappedFile
        {
        public:
                MemoryMappedFile() = default;
                ~MemoryMappedFile();

                bool open(const std::string &path, std::size_t size);
                void close();

                void *data() const noexcept { return mapped_; }
                std::size_t size() const noexcept { return size_; }
                bool valid() const noexcept { return mapped_ != nullptr; }

        private:
                void *mapped_ = nullptr;
                std::size_t size_ = 0;

#ifdef _WIN32
                HANDLE mapping_handle_ = nullptr;
                HANDLE file_handle_ = nullptr;
#endif
        };

        // Single Producer Single Consumer lock-free ring buffer.
        // The head and tail counters are each cache-line aligned to prevent false sharing.
        template <std::size_t Capacity>
        class SpscQueue
        {
        public:
                static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be power of 2");

                SpscQueue() noexcept : head_(0), tail_(0) {}

                bool enqueue(const IngestRecord &sample) noexcept
                {
                        const auto current_tail = tail_.load(std::memory_order_relaxed);
                        const auto next_tail = (current_tail + 1) & mask_;
                        if (next_tail == head_.load(std::memory_order_acquire))
                        {
                                return false; // queue is full
                        }
                        buffer_[current_tail] = sample;
                        tail_.store(next_tail, std::memory_order_release);
                        return true;
                }

                bool try_dequeue(IngestRecord &out) noexcept
                {
                        const auto current_head = head_.load(std::memory_order_relaxed);
                        if (current_head == tail_.load(std::memory_order_acquire))
                        {
                                return false; // queue empty
                        }
                        out = buffer_[current_head];
                        head_.store((current_head + 1) & mask_, std::memory_order_release);
                        return true;
                }

                bool empty() const noexcept
                {
                        return head_.load(std::memory_order_acquire) == tail_.load(std::memory_order_acquire);
                }

        private:
                static constexpr std::size_t mask_ = Capacity - 1;
                alignas(64) std::atomic<std::size_t> head_;
                alignas(64) std::atomic<std::size_t> tail_;
                alignas(64) IngestRecord buffer_[Capacity];
        };

        class NativeIngestionEngine
        {
        public:
                explicit NativeIngestionEngine();
                ~NativeIngestionEngine();

                bool initialize(const std::string &path, std::size_t max_records);
                bool enqueue(const IngestRecord &record) noexcept;
                void shutdown() noexcept;

                // Computes the moving average of the ingested price stream.
                double compute_price_moving_average() const noexcept;
                std::size_t records_ingested() const noexcept;

        private:
                void storage_thread_loop();
                static double moving_average_avx512(const float *prices, std::size_t count) noexcept;

                MemoryMappedFile mmap_file_;
                infradb::concurrency::LockFreeQueue<IngestRecord, 1024> queue_;
                std::thread storage_thread_;
                std::atomic<bool> running_ = false;
                std::atomic<std::size_t> write_offset_ = 0;
                std::vector<float> price_buffer_;
                std::atomic<double> latest_moving_average_ = 0.0;
                std::size_t max_record_count_ = 0;
        };

} // namespace infradb::core
