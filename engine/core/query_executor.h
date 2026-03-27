#pragma once
#include <string>
#include <vector>
#include <memory>
#include "thread_pool.h"

namespace infradb::core {

struct ExecutionResult {
    std::vector<std::string> rows;
    uint64_t duration_ms;
    std::string error;
};

class QueryExecutor {
public:
    explicit QueryExecutor(std::shared_ptr<ThreadPool> pool);
    std::future<ExecutionResult> execute(const std::string& sql, const std::string& db);

private:
    std::shared_ptr<ThreadPool> thread_pool;
};

}
