#pragma once
#include <vector>
#include <string>
#include <memory>
#include "infradb/core/Engine.hpp"

namespace infradb::execution {

struct ExecutionResult {
    std::vector<std::string> column_names;
    std::vector<std::string> column_types;
    // In real prod, this would be a pointer to an Arrow RecordBatch
    size_t row_count;
};

class PhysicalOperator {
public:
    virtual ~PhysicalOperator() = default;
    virtual void open() = 0;
    virtual bool next() = 0; // Pull-based execution (Volcano model)
    virtual void close() = 0;
};

class ScanOperator : public PhysicalOperator {
    std::string table_path;
public:
    ScanOperator(std::string path) : table_path(std::move(path)) {}
    void open() override {}
    bool next() override { return false; } // Simplified
    void close() override {}
};

class Pipeline {
    std::vector<std::unique_ptr<PhysicalOperator>> operators;
public:
    void add_operator(std::unique_ptr<PhysicalOperator> op) {
        operators.push_back(std::move(op));
    }
    
    void execute() {
        for (auto& op : operators) op->open();
        // Execution loop...
        for (auto& op : operators) op->close();
    }
};

} // namespace infradb::execution
