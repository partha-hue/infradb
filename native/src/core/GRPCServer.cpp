#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdlib>
#include <future>
#include <iostream>
#include <memory>
#include <string>
#include <vector>
#include <grpcpp/grpcpp.h>
#include "engine.grpc.pb.h"
#include "infradb/core/Engine.hpp"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;
using infradb::engine::ExplainResponse;
using infradb::engine::QueryEngine;
using infradb::engine::QueryRequest;
using infradb::engine::QueryResponse;

class QueryEngineServiceImpl final : public QueryEngine::Service
{
    infradb::core::Engine engine;

    static std::string trim(const std::string &value)
    {
        auto first = value.find_first_not_of(" \t\n\r");
        auto last = value.find_last_not_of(" \t\n\r");
        return first == std::string::npos ? std::string() : value.substr(first, last - first + 1);
    }

    static std::vector<std::string> split_sql_statements(const std::string &sql)
    {
        std::vector<std::string> statements;
        std::string current;
        bool in_single = false;
        bool in_double = false;
        bool escaping = false;

        for (char ch : sql)
        {
            if (escaping)
            {
                current.push_back(ch);
                escaping = false;
                continue;
            }
            if (ch == '\\')
            {
                current.push_back(ch);
                escaping = true;
                continue;
            }
            if (ch == '\'' && !in_double)
            {
                in_single = !in_single;
                current.push_back(ch);
                continue;
            }
            if (ch == '"' && !in_single)
            {
                in_double = !in_double;
                current.push_back(ch);
                continue;
            }
            if (ch == ';' && !in_single && !in_double)
            {
                auto trimmed = trim(current);
                if (!trimmed.empty())
                {
                    statements.push_back(trimmed);
                }
                current.clear();
                continue;
            }
            current.push_back(ch);
        }

        auto leftover = trim(current);
        if (!leftover.empty())
        {
            statements.push_back(leftover);
        }
        return statements;
    }

    Status ExecuteQuery(ServerContext *context, const QueryRequest *request, QueryResponse *response) override
    {
        std::cout << "[SERVER] Received Query: " << request->query() << " for DB: " << request->database_id() << std::endl;

        try
        {
            auto statements = split_sql_statements(request->query());
            if (statements.empty())
            {
                response->set_error("No SQL statements found in the request.");
                return Status::OK;
            }

            auto start = std::chrono::high_resolution_clock::now();
            std::vector<std::future<infradb::execution::VectorBatch>> futures;
            futures.reserve(statements.size());

            for (const auto &statement : statements)
            {
                futures.emplace_back(std::async(std::launch::async, [this, statement]()
                                                { return this->engine.scan_file(statement); }));
            }

            size_t total_rows = 0;
            for (auto &future : futures)
            {
                auto batch = future.get();
                total_rows += batch.num_rows();
            }

            auto end = std::chrono::high_resolution_clock::now();
            std::chrono::duration<double, std::milli> diff = end - start;

            response->set_job_id("job-" + std::to_string(std::rand()));
            response->set_rows_affected(static_cast<int64_t>(total_rows));
            response->set_execution_time_ms(diff.count());
        }
        catch (const std::exception &e)
        {
            response->set_error(e.what());
        }

        return Status::OK;
    }

    Status ExplainQuery(ServerContext *context, const QueryRequest *request, ExplainResponse *response) override
    {
        response->set_plan_json("{\"plan\": \"Vectorized Scan\", \"cost\": 10.5}");
        response->set_estimated_cost(10.5);
        return Status::OK;
    }
};

void RunServer()
{
    std::string server_address("0.0.0.0:50051");
    QueryEngineServiceImpl service;

    ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<Server> server(builder.BuildAndStart());
    std::cout << "[SERVER] Engine listening on " << server_address << std::endl;
    server->Wait();
}

int main(int argc, char **argv)
{
    RunServer();
    return 0;
}
