#pragma once
#include <string>
#include <vector>
#include <memory>
#include <future>
#include "infradb/concurrency/TaskScheduler.hpp" // Utilizing your existing scheduler

namespace infradb::core {

struct ExecutionResult {
    std::vector<std::string> rows;
    uint64_t duration_ms;
    std::string error;
};

class QueryExecutor {
public:
    QueryExecutor() = default;
    std::future<ExecutionResult> execute(const std::string& sql, const std::string& db);
};

}
