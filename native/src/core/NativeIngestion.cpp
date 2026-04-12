#include "core/NativeIngestion.hpp"
#include <cstring>
#ifdef _WIN32
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#endif

namespace infradb::core
{

        MemoryMappedFile::~MemoryMappedFile()
        {
                close();
        }

        bool MemoryMappedFile::open(const std::string &path, std::size_t size)
        {
                close();

#ifdef _WIN32
                file_handle_ = CreateFileA(path.c_str(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ, nullptr, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
                if (file_handle_ == INVALID_HANDLE_VALUE)
                {
                        return false;
                }
                LARGE_INTEGER desired_size;
                desired_size.QuadPart = static_cast<LONGLONG>(size);
                if (!SetFilePointerEx(file_handle_, desired_size, nullptr, FILE_BEGIN) || !SetEndOfFile(file_handle_))
                {
                        close();
                        return false;
                }

                mapping_handle_ = CreateFileMappingA(file_handle_, nullptr, PAGE_READWRITE, 0, static_cast<DWORD>(size), nullptr);
                if (!mapping_handle_)
                {
                        close();
                        return false;
                }

                mapped_ = MapViewOfFile(mapping_handle_, FILE_MAP_WRITE, 0, 0, size);
                if (!mapped_)
                {
                        close();
                        return false;
                }
#else
                int fd = ::open(path.c_str(), O_RDWR | O_CREAT, 0644);
                if (fd < 0)
                {
                        return false;
                }
                if (ftruncate(fd, static_cast<off_t>(size)) != 0)
                {
                        ::close(fd);
                        return false;
                }
                mapped_ = mmap(nullptr, size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
                ::close(fd);
                if (mapped_ == MAP_FAILED)
                {
                        mapped_ = nullptr;
                        return false;
                }
#endif
                size_ = size;
                return true;
        }

        void MemoryMappedFile::close()
        {
                if (!mapped_)
                {
                        return;
                }

#ifdef _WIN32
                if (mapped_)
                {
                        FlushViewOfFile(mapped_, size_);
                        UnmapViewOfFile(mapped_);
                        mapped_ = nullptr;
                }
                if (mapping_handle_)
                {
                        CloseHandle(mapping_handle_);
                        mapping_handle_ = nullptr;
                }
                if (file_handle_)
                {
                        CloseHandle(file_handle_);
                        file_handle_ = nullptr;
                }
#else
                msync(mapped_, size_, MS_SYNC);
                munmap(mapped_, size_);
                mapped_ = nullptr;
#endif
                size_ = 0;
        }

        NativeIngestionEngine::NativeIngestionEngine() = default;

        NativeIngestionEngine::~NativeIngestionEngine()
        {
                shutdown();
        }

        bool NativeIngestionEngine::initialize(const std::string &path, std::size_t max_records)
        {
                const std::size_t required_size = max_records * sizeof(IngestRecord);
                if (!mmap_file_.open(path, required_size))
                {
                        return false;
                }

                max_record_count_ = max_records;
                price_buffer_.reserve(max_records);
                running_.store(true, std::memory_order_release);
                storage_thread_ = std::thread(&NativeIngestionEngine::storage_thread_loop, this);
                return true;
        }

        bool NativeIngestionEngine::enqueue(const IngestRecord &record) noexcept
        {
                return queue_.enqueue(record);
        }

        void NativeIngestionEngine::shutdown() noexcept
        {
                running_.store(false, std::memory_order_release);
                if (storage_thread_.joinable())
                {
                        storage_thread_.join();
                }
                mmap_file_.close();
        }

        std::size_t NativeIngestionEngine::records_ingested() const noexcept
        {
                return write_offset_.load(std::memory_order_acquire) / sizeof(IngestRecord);
        }

        double NativeIngestionEngine::compute_price_moving_average() const noexcept
        {
                return latest_moving_average_.load(std::memory_order_acquire);
        }

        void NativeIngestionEngine::storage_thread_loop()
        {
                const auto *const base = static_cast<std::uint8_t *>(mmap_file_.data());
                auto offset = write_offset_.load(std::memory_order_acquire);
                IngestRecord record;

                while (running_.load(std::memory_order_acquire) || !queue_.empty())
                {
                        if (!queue_.try_dequeue(record))
                        {
                                std::this_thread::yield();
                                continue;
                        }

                        const std::size_t next_offset = offset + sizeof(IngestRecord);
                        if (next_offset > mmap_file_.size())
                        {
                                break;
                        }

                        std::memcpy(base + offset, &record, sizeof(IngestRecord));
                        offset = next_offset;
                        write_offset_.store(offset, std::memory_order_release);

                        if (price_buffer_.size() < max_record_count_)
                        {
                                price_buffer_.push_back(static_cast<float>(record.price));
                        }

                        if (price_buffer_.size() == max_record_count_)
                        {
                                latest_moving_average_.store(moving_average_avx512(price_buffer_.data(), price_buffer_.size()), std::memory_order_release);
                        }
                }
        }

#if defined(__AVX512F__)
#include <immintrin.h>
#endif

        double NativeIngestionEngine::moving_average_avx512(const float *values, std::size_t count) noexcept
        {
                if (count == 0)
                {
                        return 0.0;
                }

#if defined(__AVX512F__)
                const std::size_t stride = 16;
                std::size_t i = 0;
                __m512 acc = _mm512_setzero_ps();

                for (; i + stride <= count; i += stride)
                {
                        __m512 v = _mm512_loadu_ps(values + i);
                        acc = _mm512_add_ps(acc, v);
                }

                alignas(64) float temp[stride];
                _mm512_store_ps(temp, acc);
                double sum = 0.0;
                for (std::size_t j = 0; j < stride; ++j)
                {
                        sum += temp[j];
                }

                for (; i < count; ++i)
                {
                        sum += values[i];
                }
                return sum / static_cast<double>(count);
#else
                double sum = 0.0;
                for (std::size_t i = 0; i < count; ++i)
                {
                        sum += values[i];
                }
                return sum / static_cast<double>(count);
#endif
        }

} // namespace infradb::core
