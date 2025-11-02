import pandas as pd
from typing import Tuple, List, Dict
import re

def sanitize_column_name(name: str) -> str:
    """Convert column name to valid SQL identifier"""
    # Replace spaces and special chars with underscore
    name = re.sub(r'[^a-zA-Z0-9_]', '_', str(name))
    # Remove leading digits
    name = re.sub(r'^\d+', '', name)
    # Ensure it's not empty
    if not name:
        name = 'column'
    return name.lower()

def infer_sql_type(series: pd.Series) -> str:
    """Infer SQL data type from pandas series"""
    dtype = series.dtype
    if pd.api.types.is_integer_dtype(dtype):
        return 'INTEGER'
    elif pd.api.types.is_float_dtype(dtype):
        return 'FLOAT'
    elif pd.api.types.is_datetime64_any_dtype(dtype):
        return 'DATETIME'
    elif pd.api.types.is_bool_dtype(dtype):
        return 'BOOLEAN'
    else:
        # Get max length for VARCHAR
        max_len = series.astype(str).str.len().max()
        return f'VARCHAR({max_len + 50})'  # Add buffer for safety

def generate_create_table_sql(df: pd.DataFrame, table_name: str) -> str:
    """Generate CREATE TABLE SQL statement from DataFrame"""
    columns = []
    for col in df.columns:
        col_name = sanitize_column_name(col)
        sql_type = infer_sql_type(df[col])
        columns.append(f"`{col_name}` {sql_type}")
    
    columns_sql = ",\n    ".join(columns)
    return f"CREATE TABLE IF NOT EXISTS `{table_name}` (\n    {columns_sql}\n);"

def generate_insert_sql(df: pd.DataFrame, table_name: str) -> Tuple[str, List[tuple]]:
    """Generate INSERT INTO SQL statement and values"""
    # Sanitize column names
    columns = [sanitize_column_name(col) for col in df.columns]
    
    # Create the INSERT statement
    cols_str = ", ".join([f"`{col}`" for col in columns])
    vals_str = ", ".join(["%s" for _ in columns])
    sql = f"INSERT INTO `{table_name}` ({cols_str}) VALUES ({vals_str})"
    
    # Convert DataFrame to list of tuples
    values = [tuple(x) for x in df.replace({pd.NA: None}).values]
    
    return sql, values

def process_excel(file_path: str, sheet_name: str = None) -> Dict:
    """Process Excel file and return table creation and insert statements"""
    try:
        # Read Excel file
        if sheet_name:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
        else:
            df = pd.read_excel(file_path)
        
        # Generate table name from file name
        table_name = re.sub(r'[^a-zA-Z0-9_]', '_', 
                           file_path.split('/')[-1].split('\\')[-1].split('.')[0].lower())
        
        # Generate SQL statements
        create_sql = generate_create_table_sql(df, table_name)
        insert_sql, values = generate_insert_sql(df, table_name)
        
        return {
            'table_name': table_name,
            'create_sql': create_sql,
            'insert_sql': insert_sql,
            'values': values,
            'row_count': len(df),
            'column_count': len(df.columns)
        }
    except Exception as e:
        raise Exception(f"Error processing Excel file: {str(e)}")