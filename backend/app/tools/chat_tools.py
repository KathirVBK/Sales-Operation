"""
Chat memory tools for storing and retrieving conversation history.
All history is scoped per thread_id to support multi-user/thread isolation.
"""
from datetime import datetime
from app.database.database import get_connection
from app.logging_config import get_logger

logger = get_logger(__name__)

MESSAGES_SCHEMA_V2 = """
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL DEFAULT 'default_thread',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    intent TEXT,
    trace_json TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);
"""


def _migrate_messages_table_if_needed(conn) -> None:
    """Ensure thread_id column exists on existing messages tables."""
    cols = [row[1] for row in conn.execute("PRAGMA table_info(messages)").fetchall()]
    if "thread_id" not in cols:
        logger.warning("Migrating messages table: adding thread_id column")
        conn.execute("ALTER TABLE messages ADD COLUMN thread_id TEXT NOT NULL DEFAULT 'default_thread'")


def _ensure_index(conn) -> None:
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)")


def init_chat_table():
    with get_connection() as conn:
        conn.executescript(MESSAGES_SCHEMA_V2)
        _migrate_messages_table_if_needed(conn)
        _ensure_index(conn)
        conn.commit()
    logger.info("Chat table initialized (messages table v2)")


def save_message(
    role: str,
    content: str,
    thread_id: str = "default_thread",
    intent: str = None,
    trace_json: str = None,
) -> int:
    if not role or not isinstance(role, str):
        raise ValueError("role is required and must be a string")
    if content is None or not isinstance(content, str):
        raise ValueError("content is required and must be a string")
    if not thread_id or not isinstance(thread_id, str):
        thread_id = "default_thread"

    safe_role = role.strip().lower()[:32]
    safe_thread_id = thread_id.strip()[:128]

    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO messages (thread_id, role, content, intent, trace_json, timestamp)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (
                safe_thread_id,
                safe_role,
                content,
                intent,
                trace_json,
                datetime.utcnow().isoformat(),
            ),
        )
        conn.commit()
        return cursor.lastrowid


def get_chat_history(thread_id: str = "default_thread", limit: int = 50) -> list[dict]:
    if not thread_id or not isinstance(thread_id, str):
        thread_id = "default_thread"
    limit = max(1, min(int(limit), 500))

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, thread_id, role, content, intent, trace_json, timestamp"
            " FROM messages WHERE thread_id = ? ORDER BY id ASC LIMIT ?",
            (thread_id.strip(), limit),
        ).fetchall()
        return [dict(r) for r in rows]


def clear_chat_history(thread_id: str = "default_thread") -> int:
    """Delete messages for a given thread. Returns number of rows deleted."""
    if not thread_id or not isinstance(thread_id, str):
        thread_id = "default_thread"
    safe_thread_id = thread_id.strip()

    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM messages WHERE thread_id = ?",
            (safe_thread_id,),
        )
        conn.commit()
        return cursor.rowcount
