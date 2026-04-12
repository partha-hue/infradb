#pragma once
#include <string>
#include <vector>
#include <future>
#include "infradb/execution/VectorBatch.hpp"

namespace infradb::core
{

    /**
     * Main InfraDB execution engine entry point.
     * Provides high-level APIs for Django via the Python bridge.
     */
    class Engine
    {
    public:
        Engine();
        ~Engine();

        /**
         * High-speed parallel file scan (CSV/JSON).
         * Releases GIL during execution to allow Python parallelism.
         */
        execution::VectorBatch scan_file(const std::string &path);

        /**
         * Execute one or more SQL statements in a single request.
         */
        execution::VectorBatch execute_sql(const std::string &sql);

        /**
         * Advanced SQL Optimization and physical plan generation.
         */
        void optimize_plan(const std::string &logical_plan);

    private:
        std::string internal_state_;
    };

} // namespace infradb::core
