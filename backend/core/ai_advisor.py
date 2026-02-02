import logging
import json
import pandas as pd
from typing import List, Dict, Any
from .db_manager import DBManager

logger = logging.getLogger(__name__)

class AIAdvisor:
    def __init__(self, manager: DBManager, co_client: Any):
        self.manager = manager
        self.co = co_client

    def _get_schema_summary(self) -> str:
        """Fetch full schema metadata across all supported DB types."""
        summary = []
        try:
            cur = self.manager.cursor
            db_type = self.manager.db_type
            
            tables = []
            if db_type == "sqlite":
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'django_%' AND name NOT LIKE 'auth_%';")
                tables = [r[0] for r in cur.fetchall()]
                for t in tables:
                    cur.execute(f"PRAGMA table_info(`{t}`);")
                    cols = [f"{c[1]} ({c[2]})" for c in cur.fetchall()]
                    summary.append(f"Table: {t}\nColumns: {', '.join(cols)}")
            
            elif db_type == "postgresql":
                cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
                tables = [r[0] for r in cur.fetchall()]
                for t in tables:
                    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s AND table_schema = 'public'", [t])
                    cols = [f"{c[0]} ({c[1]})" for c in cur.fetchall()]
                    summary.append(f"Table: {t}\nColumns: {', '.join(cols)}")
            
            elif db_type == "mysql":
                cur.execute("SHOW TABLES")
                # MySQL returns dicts if using dictionary cursor
                raw_tables = cur.fetchall()
                tables = [list(r.values())[0] if isinstance(r, dict) else r[0] for r in raw_tables]
                for t in tables:
                    if t.startswith(('django_', 'auth_')): continue
                    cur.execute(f"DESCRIBE `{t}`")
                    raw_cols = cur.fetchall()
                    cols = []
                    for c in raw_cols:
                        name = c['Field'] if isinstance(c, dict) else c[0]
                        type_ = c['Type'] if isinstance(c, dict) else c[1]
                        cols.append(f"{name} ({type_})")
                    summary.append(f"Table: {t}\nColumns: {', '.join(cols)}")
            
            elif db_type == "mongodb":
                db = self.manager.conn[self.manager.config.get("database")]
                tables = db.list_collection_names()
                for t in tables:
                    summary.append(f"Collection: {t} (No schema structure for MongoDB)")

            return "\n\n".join(summary)
        except Exception as e:
            logger.error(f"Schema summary error: {e}")
            return f"Error fetching schema: {str(e)}"

    def _get_data_samples(self, tables: List[str]) -> str:
        """Fetch sample data for a wider range of tables to help AI detect real patterns."""
        samples = []
        # Increase sample size to 10 tables for a more comprehensive analysis
        for t in tables[:10]: 
            try:
                # Use standard SQL escaping
                res = self.manager.execute(f"SELECT * FROM `{t}` LIMIT 5")
                if res and "rows" in res[0] and res[0]["rows"]:
                    df = pd.DataFrame(res[0]["rows"], columns=res[0]["columns"])
                    samples.append(f"Data for {t} (first 5 rows):\n{df.to_string(index=False)}")
            except:
                pass
        return "\n\n".join(samples)

    def analyze_and_suggest(self) -> Dict[str, Any]:
        """Orchestrate AI analysis using the ACTUAL schema and data samples."""
        if not self.co:
            return {"error": "AI client not initialized"}

        schema_text = self._get_schema_summary()
        if "Error fetching schema" in schema_text:
            return {"error": schema_text}

        # Extract table names from summary
        table_names = [line.split(": ")[1] for line in schema_text.split("\n") if line.startswith("Table: ") or line.startswith("Collection: ")]
        data_text = self._get_data_samples(table_names)

        prompt = f"""
        You are a Database Expert. Analyze the ACTUAL database structure and data provided below.
        DO NOT suggest generic tables like 'Orders' or 'Customers' unless they exist in the schema below.
        Base your suggestions ONLY on the tables and columns listed.

        ACTUAL SCHEMA:
        {schema_text}

        DATA SAMPLES:
        {data_text}

        Suggest optimizations in 3 categories:
        1. Normalization: Look for redundant data patterns in the samples.
        2. Indexes: Identify performance bottlenecks based on likely JOIN and filter columns.
        3. Foreign Keys: Detect missing formal relationships between existing tables.

        Return valid JSON with keys: "normalization", "indexes", "foreign_keys".
        Each value must be a list of objects with "table", "suggestion", and "reason".
        """

        try:
            response = self.co.chat(message=prompt)
            text = response.text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start == -1 or end == 0:
                # Fallback if AI didn't return JSON
                return {"error": "AI failed to generate a structured report. Try again."}
            return json.loads(text[start:end])
        except Exception as e:
            logger.error(f"Advisor analysis error: {e}")
            return {"error": str(e)}
