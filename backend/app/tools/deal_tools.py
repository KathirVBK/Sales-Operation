"""
Deal database CRUD tools.
"""
from datetime import datetime
from app.database.database import get_connection
from app.logging_config import get_logger

logger = get_logger(__name__)

VALID_DEAL_STATUSES = {"OPEN", "WON", "LOST"}


def create_deal(lead_id: int, deal_value: float = None) -> int:
    """Create a deal linked to a lead. Returns deal id."""
    if deal_value is not None:
        try:
            deal_value = float(deal_value)
            if deal_value < 0:
                logger.warning("create_deal: negative deal_value=%s clamped to 0 for lead_id=%s",
                               deal_value, lead_id)
                deal_value = 0.0
        except (TypeError, ValueError):
            logger.warning("create_deal: invalid deal_value=%r for lead_id=%s; storing None",
                           deal_value, lead_id)
            deal_value = None

    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO deals (lead_id, deal_value, status, created_at) VALUES (?, ?, ?, ?)",
            (lead_id, deal_value, "OPEN", datetime.utcnow().isoformat()),
        )
        conn.commit()
        deal_id = cursor.lastrowid
        logger.info("Created deal_id=%s for lead_id=%s value=%s",
                    deal_id, lead_id, deal_value)
        return deal_id


def mark_deal_won(deal_id: int) -> bool:
    with get_connection() as conn:
        conn.execute(
            "UPDATE deals SET status = 'WON', won_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), deal_id),
        )
        conn.commit()
    logger.info("Marked deal_id=%s as WON", deal_id)
    return True


def get_deal_by_id(deal_id: int) -> dict | None:
    try:
        deal_id_int = int(deal_id)
    except (TypeError, ValueError):
        logger.warning("get_deal_by_id: invalid deal_id=%r", deal_id)
        return None
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id_int,)).fetchone()
        return dict(row) if row else None


def get_deal_by_company(company_name: str) -> dict | None:
    """Find the most recent deal for a company via the leads table."""
    if not company_name or not isinstance(company_name, str):
        return None
    search = f"%{company_name.lower().strip()}%"
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT d.* FROM deals d
            JOIN leads l ON d.lead_id = l.id
            WHERE LOWER(l.company_name) LIKE ?
            ORDER BY d.id DESC LIMIT 1
            """,
            (search,),
        ).fetchone()
        return dict(row) if row else None


def get_all_deals() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT d.*, l.company_name, l.contact_name, l.score, l.tier
            FROM deals d
            JOIN leads l ON d.lead_id = l.id
            ORDER BY d.id DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_deal_with_lead(deal_id: int) -> dict | None:
    try:
        deal_id_int = int(deal_id)
    except (TypeError, ValueError):
        logger.warning("get_deal_with_lead: invalid deal_id=%r", deal_id)
        return None
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT d.*, l.company_name, l.contact_name, l.email,
                   l.score, l.tier, l.need, l.budget, l.timeline,
                   l.outreach_subject, l.outreach_body
            FROM deals d
            JOIN leads l ON d.lead_id = l.id
            WHERE d.id = ?
            """,
            (deal_id_int,),
        ).fetchone()
        return dict(row) if row else None
