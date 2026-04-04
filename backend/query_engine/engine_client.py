from __future__ import annotations

import sys
from pathlib import Path
from time import perf_counter


class NativeEngineClient:
    def __init__(self):
        self._engine_module = None

    @property
    def available(self):
        return self._load_engine() is not None

    def scan_database(self, file_path: str):
        module = self._load_engine()
        if module is None:
            return {"available": False}

        started = perf_counter()
        engine = module.Engine()
        batch = engine.execute_optimized_scan(file_path)
        duration_ms = round((perf_counter() - started) * 1000, 3)
        return {
            "available": True,
            "scan_row_estimate": batch.row_count,
            "scan_duration_ms": duration_ms,
            "label": "pybind-native",
        }

    def _load_engine(self):
        if self._engine_module is not None:
            return self._engine_module

        release_dir = Path(__file__).resolve().parent.parent.parent / "native" / "build" / "Release"
        if release_dir.exists():
            release_dir_str = str(release_dir)
            if release_dir_str not in sys.path:
                sys.path.insert(0, release_dir_str)

        try:
            import infradb_core  # type: ignore
        except Exception:
            self._engine_module = None
        else:
            self._engine_module = infradb_core

        return self._engine_module
