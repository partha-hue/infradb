#pragma once
#include <cstdint>
#include <cstddef>
#if defined(__AVX2__)
#include <immintrin.h>
#endif

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

#if defined(__AVX2__)
        const __m256i threshold_vec = _mm256_set1_epi32(threshold);
        const size_t simd_width = 8;
        size_t i = 0;

        for (; i + simd_width <= size; i += simd_width) {
            const __m256i values = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(input + i));
            const __m256i cmp = _mm256_cmpgt_epi32(values, threshold_vec);
            const int lane_mask = _mm256_movemask_ps(_mm256_castsi256_ps(cmp));

            if (lane_mask == 0) {
                continue;
            }

            for (size_t lane = 0; lane < simd_width; ++lane) {
                if ((lane_mask >> lane) & 0x1) {
                    output[count++] = input[i + lane];
                }
            }
        }

        for (; i < size; ++i) {
            if (input[i] > threshold) {
                output[count++] = input[i];
            }
        }
#else
        for (size_t i = 0; i < size; ++i) {
            if (input[i] > threshold) {
                output[count++] = input[i];
            }
        }
#endif

        return count;
    }

    /**
     * SIMD Optimized Summation.
     */
    static double vectorized_sum(const double* __restrict__ data, size_t size) {
#if defined(__AVX2__)
        const size_t simd_width = 4;
        size_t i = 0;
        __m256d acc = _mm256_setzero_pd();

        for (; i + simd_width <= size; i += simd_width) {
            const __m256d v = _mm256_loadu_pd(data + i);
            acc = _mm256_add_pd(acc, v);
        }

        alignas(32) double lanes[4];
        _mm256_store_pd(lanes, acc);
        double total = lanes[0] + lanes[1] + lanes[2] + lanes[3];

        for (; i < size; ++i) {
            total += data[i];
        }
        return total;
#else
        double total = 0.0;
        for (size_t i = 0; i < size; ++i) {
            total += data[i];
        }
        return total;
#endif
    }
};

} // namespace infradb::compute
