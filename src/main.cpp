#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <vector>
#include <memory>
#include "infradb/core/Engine.hpp"
#include "infradb/core/QueryExecutor.hpp"

// Simple Health Check Server for Deployment (Render/Docker)
#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>
#endif

void run_health_check_server(int port) {
    #ifdef _WIN32
        WSADATA wsaData;
        WSAStartup(MAKEWORD(2, 2), &wsaData);
    #endif

    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    #ifndef _WIN32
        int opt_val = 1;
        setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt_val, sizeof(opt_val));
    #endif

    struct sockaddr_in address;
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);

    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) < 0) {
        std::cerr << "[Core] Bind failed to port " << port << std::endl;
        return;
    }

    if (listen(server_fd, 5) < 0) {
        std::cerr << "[Core] Listen failed" << std::endl;
        return;
    }

    std::cout << "[Core] Health Check Server running on port " << port << std::endl;

    while (true) {
        int new_socket = accept(server_fd, nullptr, nullptr);
        if (new_socket >= 0) {
            std::string response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\n\r\nOK";
            #ifdef _WIN32
                send(new_socket, response.c_str(), (int)response.length(), 0);
                closesocket(new_socket);
            #else
                send(new_socket, response.c_str(), response.length(), 0);
                close(new_socket);
            #endif
        }
    }
}

int main() {
    std::cout << "-------------------------------------------" << std::endl;
    std::cout << "   InfraDB Native Engine v3.0 (SIMD/AVX)   " << std::endl;
    std::cout << "-------------------------------------------" << std::endl;
    
    // Initialize High-Performance Components
    auto engine = std::make_unique<infradb::core::Engine>();
    auto executor = std::make_unique<infradb::core::QueryExecutor>();
    
    std::cout << "[Core] Engine Components Initialized Successfully." << std::endl;

    // Get port from environment (Render/Cloud) or default to 8080
    const char* port_env = std::getenv("PORT");
    int port = port_env ? std::stoi(port_env) : 8080;

    // Start health check server (Requirement for most Cloud Deploys)
    std::thread health_thread(run_health_check_server, port);
    
    std::cout << "[Core] InfraDB is active and listening for optimized workloads." << std::endl;
    
    // In a production scenario, we would also start the gRPC or WebSocket 
    // server here to handle real-time database traffic.
    
    health_thread.join();
    
    return 0;
}
