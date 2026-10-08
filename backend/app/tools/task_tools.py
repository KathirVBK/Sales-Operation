"""
Task database CRUD tools and status transition validation.
"""
from datetime import datetime
from app.database.database import get_connection
from app.logging_config import get_logger

logger = get_logger(__name__)

ALLOWED_TRANSITIONS = {
    "OPEN": ["IN_PROGRESS"],
    "IN_PROGRESS": ["DONE", "BLOCKED"],
    "BLOCKED": ["IN_PROGRESS"],
    "DONE": [],
}

VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}
VALID_STATUSES = set(ALLOWED_TRANSITIONS.keys())

DEFAULT_TASKS = [
    {"task_name": "Verify signed contract", "priority": "HIGH"},
    {"task_name": "Create Customer Account","priority": "HIGH"},
    {"task_name": "Schedule Kickoff",       "priority": "MEDIUM"},
    {"task_name": "Configure System",       "priority": "MEDIUM"},
    {"task_name": "Customer Training",      "priority": "LOW"},
]

DEPENDENCY_CHAIN = [0, 0, 1, 2, 3]


def create_onboarding_tasks(deal_id: int, lead_data: dict = None) -> list[dict]:
    """
    Create the standard set of onboarding tasks for a won deal.
    Optionally uses lead context (e.g. tier, budget) to adjust priorities.
    """
    tasks = list(DEFAULT_TASKS)

    if lead_data:
        try:
            tier = (lead_data.get("tier") or "").upper()
            budget = lead_data.get("budget") or 0
            if tier == "HOT" or (isinstance(budget, (int, float)) and budget >= 1000000):
                tasks = [
                    {**t, "priority": "HIGH" if t["priority"] == "HIGH" else "MEDIUM"}
                    for t in tasks
                ]
                logger.info("Elevated onboarding priorities for deal_id=%s (tier=%s, budget=%s)",
                            deal_id, tier, budget)
        except Exception as e:
            logger.warning("Could not apply lead-based task adjustments for deal_id=%s: %s",
                           deal_id, e)

    with get_connection() as conn:
        inserted_ids = []
        for i, task in enumerate(tasks):
            depends_on = None
            if i > 0:
                prev_index = DEPENDENCY_CHAIN[i]
                if prev_index < len(inserted_ids):
                    depends_on = inserted_ids[prev_index]
            cursor = conn.execute(
                """INSERT INTO tasks (deal_id, task_name, priority, status, depends_on, created_at)
                   VALUES (?, ?, ?, 'OPEN', ?, ?)""",
                (deal_id, task["task_name"], task["priority"], depends_on, datetime.utcnow().isoformat()),
            )
            inserted_ids.append(cursor.lastrowid)
        conn.commit()

        rows = conn.execute("SELECT * FROM tasks WHERE deal_id = ? ORDER BY id", (deal_id,)).fetchall()
        result = [dict(r) for r in rows]
        logger.info("Created %d onboarding tasks for deal_id=%s", len(result), deal_id)
        return result


def tasks_exist_for_deal(deal_id: int) -> bool:
    with get_connection() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM tasks WHERE deal_id = ?", (deal_id,)
        ).fetchone()[0]
        return count > 0


def get_tasks_for_deal(deal_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM tasks WHERE deal_id = ? ORDER BY id", (deal_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_all_tasks() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT t.*, l.company_name
            FROM tasks t
            JOIN deals d ON t.deal_id = d.id
            JOIN leads l ON d.lead_id = l.id
            ORDER BY t.id DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_task_by_id(task_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return dict(row) if row else None


def find_task_by_name_and_company(task_name: str, company_name: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT t.* FROM tasks t
            JOIN deals d ON t.deal_id = d.id
            JOIN leads l ON d.lead_id = l.id
            WHERE LOWER(t.task_name) LIKE ?
              AND LOWER(l.company_name) LIKE ?
            ORDER BY t.id DESC LIMIT 1
            """,
            (f"%{task_name.lower()}%", f"%{company_name.lower()}%"),
        ).fetchone()
        return dict(row) if row else None


def update_task_status(task_id: int, new_status: str) -> dict:
    """
    Validate transition and update task status.
    Returns {success, old_status, new_status, message}
    """
    new_status = str(new_status).strip().upper() if new_status else ""

    if new_status not in VALID_STATUSES:
        return {
            "success": False,
            "message": f"Invalid status '{new_status}'. Must be one of: {sorted(VALID_STATUSES)}",
        }

    task = get_task_by_id(task_id)
    if not task:
        logger.warning("Task update failed: task_id=%s not found", task_id)
        return {"success": False, "message": f"Task {task_id} not found"}

    old_status = task["status"]
    allowed = ALLOWED_TRANSITIONS.get(old_status, [])

    if new_status not in allowed:
        logger.warning(
            "Task status transition blocked: task_id=%s %s -> %s (allowed=%s)",
            task_id, old_status, new_status, allowed,
        )
        return {
            "success": False,
            "old_status": old_status,
            "new_status": new_status,
            "message": f"Cannot transition from {old_status} to {new_status}. Allowed: {allowed}",
        }

    with get_connection() as conn:
        conn.execute(
            "UPDATE tasks SET status = ? WHERE id = ?", (new_status, task_id)
        )
        conn.commit()

    logger.info("Task updated: task_id=%s '%s' %s -> %s",
                task_id, task["task_name"], old_status, new_status)

    return {
        "success": True,
        "task": task["task_name"],
        "old_status": old_status,
        "new_status": new_status,
        "message": f"Task updated from {old_status} to {new_status}",
    }
