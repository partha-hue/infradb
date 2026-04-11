#pragma once
#include <vector>
#include <string>
#include <memory_resource>

namespace infradb::execution {

/**
 * Supported column types for vectorized execution.
 */
enum class DataType {
    INT32,
    FLOAT64,
    STRING,
    BOOL
};

/**
 * A single column segment in the VectorBatch.
 */
struct Column {
    DataType type;
    void* data;      // Contiguous memory buffer
    bool* null_mask; // Indicates if a cell is NULL
    size_t size;
    std::string name;
};

/**
 * VectorBatch: A fixed-size (e.g., 1024 rows) data segment processed at once.
 * Optimized for CPU L1/L2 cache locality.
 */
class VectorBatch {
public:
    VectorBatch(size_t num_rows, std::pmr::memory_resource* alloc) 
        : num_rows_(num_rows), allocator_(alloc) {}

    ~VectorBatch();
    VectorBatch(const VectorBatch&) = delete;
    VectorBatch& operator=(const VectorBatch&) = delete;
    VectorBatch(VectorBatch&&) = default;
    VectorBatch& operator=(VectorBatch&&) = default;

    void add_column(DataType type, const std::string& name);
    
    size_t num_rows() const { return num_rows_; }
    const std::vector<Column>& columns() const { return columns_; }

private:
    size_t num_rows_;
    std::vector<Column> columns_;
    std::pmr::memory_resource* allocator_;
};

} // namespace infradb::execution
