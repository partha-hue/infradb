cmake_minimum_required(VERSION 3.20)
project(InfraDBEngine CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find gRPC and Protobuf
find_package(gRPC CONFIG REQUIRED)
find_package(Protobuf CONFIG REQUIRED)

# Protobuf Generation
set(PROTO_SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/proto)
set(PROTO_OUT_DIR ${CMAKE_CURRENT_BINARY_DIR}/generated)
file(MAKE_DIRECTORY ${PROTO_OUT_DIR})

set(QUERY_PROTO ${PROTO_SRC_DIR}/query.proto)
set(QUERY_PB_H ${PROTO_OUT_DIR}/query.pb.h)
set(QUERY_PB_CC ${PROTO_OUT_DIR}/query.pb.cc)
set(QUERY_GRPC_PB_H ${PROTO_OUT_DIR}/query.grpc.pb.h)
set(QUERY_GRPC_PB_CC ${PROTO_OUT_DIR}/query.grpc.pb.cc)

add_custom_command(
    OUTPUT "${QUERY_PB_H}" "${QUERY_PB_CC}" "${QUERY_GRPC_PB_H}" "${QUERY_GRPC_PB_CC}"
    COMMAND protobuf::protoc
    ARGS --cpp_out "${PROTO_OUT_DIR}" --grpc_out "${PROTO_OUT_DIR}"
         --plugin=protoc-gen-grpc="$<TARGET_FILE:gRPC::grpc_cpp_plugin>"
         -I "${PROTO_SRC_DIR}" "${QUERY_PROTO}"
    DEPENDS "${QUERY_PROTO}"
)

add_executable(infradb_engine
    main.cpp
    core/thread_pool.cpp
    core/query_executor.cpp
    "${QUERY_PB_CC}"
    "${QUERY_GRPC_PB_CC}"
)

target_include_directories(infradb_engine PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${PROTO_OUT_DIR}
)

target_link_libraries(infradb_engine PRIVATE
    gRPC::grpc++
    protobuf::libprotobuf
)
