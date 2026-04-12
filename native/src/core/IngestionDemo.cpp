#include "core/NativeIngestion.hpp"
#include <chrono>
#include <cstring>
#include <iostream>
#include <string>
#include <thread>

int main()
{
        const std::string path = "native_ingest_data.bin";
        const std::size_t max_records = 1'000'000;

        infradb::core::NativeIngestionEngine engine;
        if (!engine.initialize(path, max_records))
        {
                std::cerr << "Failed to initialize native ingestion engine." << std::endl;
                return 1;
        }

        std::cout << "[Demo] Enqueuing " << max_records << " records into the lock-free SPSC ingestion pipeline." << std::endl;

        for (std::size_t i = 0; i < max_records; ++i)
        {
                infradb::core::IngestRecord record;
                std::memset(&record, 0, sizeof(record));
                const std::string symbol = (i % 3 == 0) ? "AAPL" : ((i % 3 == 1) ? "TSLA" : "BTC");
                std::memcpy(record.symbol, symbol.c_str(), symbol.size());
                record.price = 100.0 + static_cast<double>(i % 1000) * 0.1;
                record.volume = static_cast<int32_t>(i % 500);
                record.timestamp = static_cast<int64_t>(std::chrono::duration_cast<std::chrono::seconds>(
                                                            std::chrono::system_clock::now().time_since_epoch())
                                                            .count());

                while (!engine.enqueue(record))
                {
                        std::this_thread::yield();
                }
        }

        engine.shutdown();

        const double average = engine.compute_price_moving_average();
        std::cout << "[Demo] Moving average over " << max_records << " rows: " << average << std::endl;
        std::cout << "[Demo] Performance grade: ";
        if (average > 0.0)
        {
                std::cout << "Computed successfully." << std::endl;
        }

        return 0;
}
