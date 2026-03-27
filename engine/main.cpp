#include <iostream>
#include <memory>
#include <string>
#include <grpcpp/grpcpp.h>

#include "query.grpc.pb.h"
#include "core/thread_pool.h"
#include "core/query_executor.h"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::ServerWriter;
using grpc::Status;
using infradb::engine::QueryService;
using infradb::engine::QueryRequest;
using infradb::engine::QueryResponse;

class QueryServiceImpl final : public QueryService::Service {
public:
    explicit QueryServiceImpl(std::shared_ptr<infradb::core::ThreadPool> pool)
        : executor(std::make_shared<infradb::core::QueryExecutor>(pool)) {}

    Status ExecuteQuery(ServerContext* context, const QueryRequest* request,
                       ServerWriter<QueryResponse>* writer) override {
        
        std::cout << "[Engine] Executing Query: " << request->sql() 
                  << " on DB: " << request->database() << std::endl;

        // Async execution via thread pool
        auto future_result = executor->execute(request->sql(), request->database());
        
        // Block until result ready (in a real streaming engine, we'd stream chunks)
        auto result = future_result.get();

        if (!result.error.empty()) {
            QueryResponse error_resp;
            error_resp.set_error_message(result.error);
            writer->Write(error_resp);
            return Status::OK;
        }

        for (const auto& row : result.rows) {
            QueryResponse response;
            response.set_row_json(row);
            response.set_execution_time_ms(result.duration_ms);
            writer->Write(response);
        }

        // Send termination chunk
        QueryResponse last;
        last.set_is_last_chunk(true);
        writer->Write(last);

        return Status::OK;
    }

private:
    std::shared_ptr<infradb::core::QueryExecutor> executor;
};

void RunServer() {
    std::string server_address("0.0.0.0:50051");
    auto pool = std::make_shared<infradb::core::ThreadPool>(std::thread::hardware_concurrency());
    QueryServiceImpl service(pool);

    ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);
    
    std::unique_ptr<Server> server(builder.BuildAndStart());
    std::cout << "[Engine] High-Performance InfraDB Engine listening on " << server_address << std::endl;
    server->Wait();
}

int main(int argc, char** argv) {
    RunServer();
    return 0;
}
