#pragma once
#include <cstdint>
#include <vector>
#include <cstddef>

namespace infradb::compute {

/**
 * Vectorized Filter: Processes blocks of values using branchless logic.
 * Designed to utilize SIMD (Single Instruction, Multiple Data) on modern CPUs.
 */
struct VectorizedKernels {
    /**
     * Branchless Greater-Than Filter.
     * This avoids CPU branch misprediction, keeping the instruction pipeline full.
     */
    static size_t filter_greater_than(
        const int32_t* __restrict__ input, 
        size_t size, 
        int32_t threshold, 
        int32_t* __restrict__ output) 
    {
        size_t count = 0;
        // Compiler will auto-vectorize this loop given AVX2/AVX512 flags.
        for (size_t i = 0; i < size; ++i) {
            // Branchless: The result of the comparison is 0 or 1.
            // Use it as a conditional offset to store the match.
            bool match = input[i] > threshold;
            output[count] = input[i];
            count += static_cast<size_t>(match);
        }
        return count;
    }

    /**
     * SIMD Optimized Summation.
     */
    static double vectorized_sum(const double* __restrict__ data, size_t size) {
        double total = 0.0;
        for (size_t i = 0; i < size; ++i) {
            total += data[i];
        }
        return total;
    }
};

} // namespace infradb::compute
