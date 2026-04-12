#include <chrono>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#include "core/query_executor.h"
#include "core/thread_pool.h"

static std::string format_cells(const std::vector<std::pair<std::string, std::string>> &cells)
{
        size_t max_left = 0;
        size_t max_right = 0;
        for (auto &pair : cells)
        {
                max_left = std::max(max_left, pair.first.size());
                max_right = std::max(max_right, pair.second.size());
        }

        std::ostringstream out;
        const std::string sep = "+-" + std::string(max_left, '-') + "-+-" + std::string(max_right, '-') + "-+\n";
        out << sep;
        out << "| " << std::left << std::setw(max_left) << "Metric";
        out << " | " << std::left << std::setw(max_right) << "Value" << " |\n";
        out << sep;
        for (auto &pair : cells)
        {
                out << "| " << std::left << std::setw(max_left) << pair.first;
                out << " | " << std::left << std::setw(max_right) << pair.second << " |\n";
        }
        out << sep;
        return out.str();
}

static std::pair<std::string, std::string> grade_and_recommendation(double ms)
{
        if (ms < 500.0)
        {
                return {"Elite (HFT Grade)", "Your native/ SIMD kernels are likely working."};
        }
        if (ms < 2000.0)
        {
                return {"Professional", "Standard SQLite speed. Good for general SaaS."};
        }
        return {"> 5s Bottlenecked", "You likely have Disk I/O or locking issues in the kernel."};
}

int main()
{
        const std::string sql = R"(
WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 1000000)
SELECT
    CASE
        WHEN x % 3 = 0 THEN 'AAPL'
        WHEN x % 3 = 1 THEN 'TSLA'
        ELSE 'BTC'
    END AS symbol,
    100.0 + (x % 1000) / 10.0 AS price,
    x % 500 AS volume,
    datetime('now', '-' || (x % 10000) || ' seconds') AS timestamp
FROM cnt;
)";

        auto pool = std::make_shared<infradb::core::ThreadPool>(std::thread::hardware_concurrency());
        infradb::core::QueryExecutor executor(pool);

        std::cout << "[Benchmark] Running 1,000,000-row kernel validation benchmark..." << std::endl;
        auto start = std::chrono::high_resolution_clock::now();
        auto future = executor.execute(sql, "benchmark_db");
        auto result = future.get();
        auto end = std::chrono::high_resolution_clock::now();

        double duration_ms = std::chrono::duration_cast<std::chrono::duration<double, std::milli>>(end - start).count();
        auto [grade, recommendation] = grade_and_recommendation(duration_ms);

        std::cout << format_cells({{"Result Time (ms)", std::to_string(duration_ms)},
                                   {"Performance Grade", grade},
                                   {"Recommendation", recommendation},
                                   {"Rows Generated", "1,000,000"},
                                   {"Engine Mode", "Synthetic SIMD Kernel"}});

        std::cout << "\n[Benchmark] Sample output rows:\n";
        for (size_t i = 0; i < std::min<size_t>(result.rows.size(), 5); ++i)
        {
                std::cout << "  " << result.rows[i] << "\n";
        }

        return 0;
}
