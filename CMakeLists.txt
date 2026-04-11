cmake_minimum_required(VERSION 3.20)
project(InfraDBCore VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

# Optimization for production
if(MSVC)
    add_compile_options(
        $<$<CONFIG:Release>:/O2>
        $<$<CONFIG:Release>:/Ot>
        $<$<CONFIG:Release>:/Oi>
        $<$<CONFIG:Release>:/GL>
        $<$<CONFIG:Release>:/arch:AVX2>
        $<$<CONFIG:Release>:/fp:fast>
        $<$<CONFIG:Release>:/DNDEBUG>
        $<$<CONFIG:RelWithDebInfo>:/O2>
        $<$<CONFIG:RelWithDebInfo>:/Ot>
        $<$<CONFIG:RelWithDebInfo>:/Oi>
        $<$<CONFIG:RelWithDebInfo>:/GL>
        $<$<CONFIG:RelWithDebInfo>:/arch:AVX2>
        $<$<CONFIG:RelWithDebInfo>:/fp:fast>
        $<$<CONFIG:RelWithDebInfo>:/DNDEBUG>
    )
    add_link_options(
        $<$<CONFIG:Release>:/LTCG>
        $<$<CONFIG:RelWithDebInfo>:/LTCG>
    )
else()
    add_compile_options(
        -pthread
        -fPIC
        $<$<CONFIG:Release>:-O3 -flto -mavx2 -march=native -mtune=native -DNDEBUG>
        $<$<CONFIG:RelWithDebInfo>:-O3 -flto -mavx2 -march=native -mtune=native -DNDEBUG>
    )
    add_link_options(
        $<$<CONFIG:Release>:-flto>
        $<$<CONFIG:RelWithDebInfo>:-flto>
    )
endif()

# Include directories
include_directories(include)

# Source files
file(GLOB_RECURSE SOURCES 
    "src/core/*.cpp"
    "src/memory/*.cpp"
    "src/execution/*.cpp"
)

# Build the main executable for Render deployment
add_executable(infradb_core_app src/main.cpp ${SOURCES})

# Also build the Python module if needed (Optional for standalone service)
# include(FetchContent)
# FetchContent_Declare(pybind11 GIT_REPOSITORY https://github.com/pybind/pybind11.git GIT_TAG v2.13.1)
# FetchContent_MakeAvailable(pybind11)
# pybind11_add_module(infradb_core src/python/bindings.cpp ${SOURCES})
