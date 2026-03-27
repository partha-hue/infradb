#include <iostream>
#include <memory>
#include <string>
#include <grpcpp/grpcpp.h>
#include "engine.grpc.pb.h"
#include "infradb/core/Engine.hpp"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;
using infradb::engine::QueryEngine;
using infradb::engine::QueryRequest;
using infradb::engine::QueryResponse;
using infradb::engine::ExplainResponse;

class QueryEngineServiceImpl final : public QueryEngine::Service {
    infradb::core::Engine engine;

    Status ExecuteQuery(ServerContext* context, const QueryRequest* request, QueryResponse* response) override {
        std::cout << "[SERVER] Received Query: " << request->query() << " for DB: " << request->database_id() << std::endl;
        
        try {
            // In a real implementation, we would parse the SQL, 
            // create an execution plan, and run it through the engine.
            auto result = engine.scan_file("dummy_path"); // Simulated scan
            
            response->set_job_id("job-" + std::to_string(rand()));
            response->set_rows_affected(5000000);
            response->set_execution_time_ms(0.45);
            // response->set_data_arrow(...); // Serialize Arrow batch
            
        } catch (const std::exception& e) {
            response->set_error(e.what());
        }
        
        return Status::OK;
    }

    Status ExplainQuery(ServerContext* context, const QueryRequest* request, ExplainResponse* response) override {
        response->set_plan_json("{\"plan\": \"Vectorized Scan\", \"cost\": 10.5}");
        response->set_estimated_cost(10.5);
        return Status::OK;
    }
};

void RunServer() {
    std::string server_address("0.0.0.0:50051");
    QueryEngineServiceImpl service;

    ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);
    
    std::unique_ptr<Server> server(builder.BuildAndStart());
    std::cout << "[SERVER] Engine listening on " << server_address << std::endl;
    server->Wait();
}

int main(int argc, char** argv) {
    RunServer();
    return 0;
}
