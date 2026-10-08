"""
Lead database CRUD tools.
"""
from datetime import datetime
from app.database.database import get_connection
from app.logging_config import get_logger

logger = get_logger(__name__)

ALLOWED_LEAD_UPDATE_FIELDS = frozenset({
    "company_name", "contact_name", "email", "inquiry",
    "budget", "need", "timeline", "decision_maker",
    "score", "tier", "status", "outreach_subject", "outreach_body",
})


def save_lead(lead_data: dict, score_result: dict, outreach: dict) -> int:
    """
    Insert a lead into the database. Returns the new lead id.
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO leads
                (company_name, contact_name, email, inquiry, budget, need,
                 timeline, decision_maker, score, tier, status,
                 outreach_subject, outreach_body, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                lead_data.get("company_name"),
                lead_data.get("contact_name"),
                lead_data.get("email"),
                lead_data.get("inquiry"),
                lead_data.get("budget"),
                lead_data.get("business_need") or lead_data.get("need"),
                lead_data.get("timeline"),
                1 if lead_data.get("decision_maker") else 0,
                score_result.get("score"),
                score_result.get("tier"),
                "NEW",
                outreach.get("subject"),
                outreach.get("body"),
                datetime.utcnow().isoformat(),
            ),
        )
        conn.commit()
        lead_id = cursor.lastrowid
        logger.info(
            "Saved lead id=%s company=%s tier=%s score=%s",
            lead_id, lead_data.get("company_name"), score_result.get("tier"), score_result.get("score"),
        )
        return lead_id


def update_lead(lead_id: int, updates: dict) -> bool:
    """
    Update specific whitelisted fields on an existing lead.
    Rejects any field not in ALLOWED_LEAD_UPDATE_FIELDS to prevent SQL injection.
    """
    if not updates:
        return False
    safe_updates = {
        k: v for k, v in updates.items() if k in ALLOWED_LEAD_UPDATE_FIELDS
    }
    if not safe_updates:
        logger.warning(
            "Lead update blocked for lead_id=%s: no allowed fields among keys=%s",
            lead_id, sorted(updates.keys()),
        )
        return False
    if len(safe_updates) != len(updates):
        rejected = sorted(set(updates.keys()) - set(safe_updates.keys()))
        logger.warning(
            "Lead update dropped non-whitelisted fields for lead_id=%s: %s",
            lead_id, rejected,
        )
    fields = ", ".join(f"{k} = ?" for k in safe_updates.keys())
    values = list(safe_updates.values()) + [lead_id]
    with get_connection() as conn:
        conn.execute(f"UPDATE leads SET {fields} WHERE id = ?", values)
        conn.commit()
    logger.info("Lead updated: lead_id=%s fields=%s", lead_id, sorted(safe_updates.keys()))
    return True


def get_lead_by_id(lead_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
        return dict(row) if row else None


def get_lead_by_company(company_name: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM leads WHERE LOWER(company_name) LIKE ? ORDER BY id DESC LIMIT 1",
            (f"%{company_name.lower()}%",),
        ).fetchone()
        return dict(row) if row else None


def get_all_leads() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM leads ORDER BY id DESC").fetchall()
        return [dict(r) for r in rows]
