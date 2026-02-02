import sqlglot
from sqlglot import exp, parse_one
from typing import List, Dict, Any

class SchemaEngine:
    def __init__(self, dialect: str = "postgres"):
        self.dialect = dialect

    def sql_to_json(self, sql: str) -> Dict[str, Any]:
        """Parses SQL string into a Visual Schema JSON model."""
        try:
            expressions = sqlglot.parse(sql, read=self.dialect)
            tables = []
            
            for expression in expressions:
                if isinstance(expression, exp.Create):
                    table_name = expression.this.this.this
                    columns = []
                    
                    # Extract columns
                    schema_def = expression.this
                    for prop in schema_def.expressions:
                        if isinstance(prop, exp.ColumnDef):
                            col_name = prop.this.this
                            col_type = str(prop.kind)
                            is_pk = any(isinstance(c, exp.ColumnConstraint) and 
                                       isinstance(c.kind, exp.PrimaryKeyColumnConstraint) 
                                       for c in prop.constraints)
                            
                            columns.append({
                                "name": col_name,
                                "type": col_type,
                                "pk": is_pk
                            })
                    
                    tables.append({
                        "name": table_name,
                        "columns": columns
                    })
            
            return {"tables": tables, "valid": True}
        except Exception as e:
            return {"tables": [], "valid": False, "error": str(e)}

    def json_to_sql(self, schema_json: Dict[str, Any]) -> str:
        """Generates SQL from a Visual Schema JSON model."""
        statements = []
        for table in schema_json.get("tables", []):
            col_defs = []
            for col in table["columns"]:
                constraints = []
                if col.get("pk"):
                    constraints.append(exp.ColumnConstraint(kind=exp.PrimaryKeyColumnConstraint()))
                
                col_defs.append(exp.ColumnDef(
                    this=exp.Identifier(this=col["name"], quoted=True),
                    kind=exp.DataType.build(col["type"]),
                    constraints=constraints
                ))
            
            create_stmt = exp.Create(
                this=exp.Schema(
                    this=exp.Table(this=exp.Identifier(this=table["name"], quoted=True)),
                    expressions=col_defs
                ),
                kind="TABLE"
            )
            statements.append(create_stmt.sql(dialect=self.dialect, pretty=True))
            
        return "\n\n".join(statements)
