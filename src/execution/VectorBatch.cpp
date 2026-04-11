#include "infradb/execution/VectorBatch.hpp"
#include <cstring>
#include <memory>

namespace infradb::execution {

VectorBatch::~VectorBatch() {
    for (const auto& col : columns_) {
        if (col.type == DataType::STRING && col.data != nullptr) {
            auto* strings = static_cast<std::string*>(col.data);
            std::destroy_n(strings, num_rows_);
        }
    }
}

void VectorBatch::add_column(DataType type, const std::string& name) {
    Column col;
    col.type = type;
    col.name = name;
    col.size = num_rows_;
    
    // Calculate byte size based on type
    size_t byte_size = 0;
    switch (type) {
        case DataType::INT32:   byte_size = sizeof(int32_t) * num_rows_; break;
        case DataType::FLOAT64: byte_size = sizeof(double) * num_rows_; break;
        case DataType::BOOL:    byte_size = sizeof(bool) * num_rows_; break;
        case DataType::STRING:  byte_size = sizeof(std::string) * num_rows_; break;
    }

    // Allocate contiguous memory from the pool
    if (byte_size > 0) {
        col.data = allocator_->allocate(byte_size);
        col.null_mask = static_cast<bool*>(allocator_->allocate(sizeof(bool) * num_rows_));

        if (type == DataType::STRING) {
            auto* strings = static_cast<std::string*>(col.data);
            std::uninitialized_default_construct_n(strings, num_rows_);
        }

        std::memset(col.null_mask, 0, sizeof(bool) * num_rows_);
    } else {
        col.data = nullptr;
        col.null_mask = nullptr;
    }

    columns_.push_back(std::move(col));
}

} // namespace infradb::execution
