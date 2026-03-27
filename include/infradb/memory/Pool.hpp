#pragma once
#include <vector>
#include <memory_resource>
#include <mutex>

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
    GlobalMemoryPool() : pool_resource(std::pmr::get_default_resource()) {}
    
    // In production, this would be a large pre-allocated upstream resource
    std::pmr::monotonic_buffer_resource pool_resource;
};

} // namespace infradb::memory
