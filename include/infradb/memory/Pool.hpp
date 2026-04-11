#pragma once
#include <cstddef>
#include <cstdlib>
#include <vector>
#include <memory_resource>

namespace infradb::memory {

/**
 * Global Memory Pool for High-Performance Buffer Allocation.
 * Uses std::pmr (Polymorphic Memory Resources) for efficient allocations.
 */
class GlobalMemoryPool {
public:
    static GlobalMemoryPool& instance() {
        static GlobalMemoryPool inst;
        return inst;
    }

    std::pmr::memory_resource* get_resource() {
        return &pool_resource;
    }

private:
    static size_t pool_size_bytes() {
        constexpr size_t default_mb = 128;
        const char* env = std::getenv("INFRA_POOL_SIZE_MB");
        if (env == nullptr) {
            return default_mb * 1024ULL * 1024ULL;
        }

        char* end = nullptr;
        const long long mb = std::strtoll(env, &end, 10);
        if (end == env || mb <= 0) {
            return default_mb * 1024ULL * 1024ULL;
        }

        return static_cast<size_t>(mb) * 1024ULL * 1024ULL;
    }

    GlobalMemoryPool()
        : backing_buffer_(pool_size_bytes()),
          pool_resource(backing_buffer_.data(), backing_buffer_.size(), std::pmr::new_delete_resource()) {}

    std::vector<std::byte> backing_buffer_;
    std::pmr::monotonic_buffer_resource pool_resource;
};

} // namespace infradb::memory
