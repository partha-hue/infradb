cmake_minimum_required(VERSION 3.15)
project(InfraDBEngine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find gRPC and Protobuf
find_package(gRPC CONFIG REQUIRED)
find_package(Protobuf CONFIG REQUIRED)

# Protobuf and gRPC generation
set(PROTO_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../native/proto")
set(PROTO_GEN_DIR "${CMAKE_CURRENT_BINARY_DIR}/gens")
file(MAKE_DIRECTORY ${PROTO_GEN_DIR})

set(proto_file "${PROTO_SRC_DIR}/engine.proto")
get_filename_component(proto_name ${proto_file} NAME_WE)

set(hw_proto_srcs "${PROTO_GEN_DIR}/${proto_name}.pb.cc")
set(hw_proto_hdrs "${PROTO_GEN_DIR}/${proto_name}.pb.h")
set(hw_grpc_srcs "${PROTO_GEN_DIR}/${proto_name}.grpc.pb.cc")
set(hw_grpc_hdrs "${PROTO_GEN_DIR}/${proto_name}.grpc.pb.h")

add_custom_command(
      OUTPUT "${hw_proto_srcs}" "${hw_proto_hdrs}" "${hw_grpc_srcs}" "${hw_grpc_hdrs}"
      COMMAND ${Protobuf_PROTOC_EXECUTABLE}
      ARGS --grpc_out "${PROTO_GEN_DIR}"
           --cpp_out "${PROTO_GEN_DIR}"
           -I "${PROTO_SRC_DIR}"
           --plugin=protoc-gen-grpc=$<TARGET_FILE:gRPC::grpc_cpp_plugin>
           "${proto_file}"
      DEPENDS "${proto_file}")

include_directories(${PROTO_GEN_DIR} ../native/include ../include)

add_executable(infradb_engine 
    ../native/src/core/Engine.cpp 
    ../native/src/core/GRPCServer.cpp
    ${hw_proto_srcs}
    ${hw_grpc_srcs}
)

target_link_libraries(infradb_engine
    gRPC::grpc++
    protobuf::libprotobuf
    Threads::Threads
)

target_compile_options(infradb_engine PRIVATE -march=native -O3)
