from datetime import datetime
from app.database.database import get_connection
from app.logging_config import get_logger

logger = get_logger(__name__)


def log_step(intent: str, agent: str, action: str, result: str) -> dict:
    """
    Persist a single execution step to the executions table and return it as a dict.
    Non-blocking failure path: if DB write fails, returns the in-memory dict and logs warning.
    """
    step = {"agent": agent, "action": action, "result": result}
    try:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO executions (intent, agent, action, result, timestamp) VALUES (?, ?, ?, ?, ?)",
                (
                    intent or "",
                    agent or "",
                    action or "",
                    str(result) if result is not None else "",
                    datetime.utcnow().isoformat(),
                ),
            )
            conn.commit()
    except Exception as e:
        logger.warning(
            "Failed to persist execution step intent=%s agent=%s action=%s: %s",
            intent, agent, action, e,
        )
    return step


def build_trace(*steps: dict) -> list:
    """Return a list of execution step dicts (filters out non-dict items)."""
    return [s for s in steps if isinstance(s, dict)]
