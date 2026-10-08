import sqlite3
from app.config import DB_PATH


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    from pathlib import Path
    import os
    schema_path = Path(__file__).parent / "schema.sql"
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_connection() as conn:
        with open(schema_path, "r") as f:
            conn.executescript(f.read())
    from app.logging_config import get_logger
    logger = get_logger(__name__)
    logger.info("Database initialized at %s", DB_PATH)
