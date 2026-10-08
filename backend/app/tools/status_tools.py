"""
Status query tools — always reads from SQLite, never invents data.
"""
from app.tools.deal_tools import get_deal_by_company
from app.tools.task_tools import get_tasks_for_deal
from app.tools.lead_tools import get_lead_by_company
from app.logging_config import get_logger

logger = get_logger(__name__)


def get_onboarding_status(company_name: str) -> dict:
    """
    Return full onboarding status for a company.
    Source of truth: SQLite only.
    """
    if not company_name or not isinstance(company_name, str):
        logger.warning("get_onboarding_status called with empty/invalid company_name")
        return {
            "found": False,
            "message": "Company name must be provided.",
        }

    lead = get_lead_by_company(company_name)
    if not lead:
        logger.info("Onboarding status query: no lead found for company=%s", company_name)
        return {
            "found": False,
            "message": f"No lead found for '{company_name}'. Please check the company name.",
        }

    deal = get_deal_by_company(company_name)
    if not deal:
        logger.info("Onboarding status query: lead=%s stage=LEAD (no deal yet)",
                    lead.get("company_name"))
        return {
            "found": True,
            "stage": "LEAD",
            "company_name": lead["company_name"],
            "lead_status": lead.get("status", "UNKNOWN"),
            "tier": lead.get("tier"),
            "score": lead.get("score"),
            "message": (
                f"{lead['company_name']} is in the leads pipeline (tier={lead.get('tier')}, "
                f"score={lead.get('score')}) but no deal has been created yet."
            ),
        }

    tasks = get_tasks_for_deal(deal["id"])
    total_tasks = len(tasks)
    done_tasks = sum(1 for t in tasks if t.get("status") == "DONE")
    blocked_tasks = sum(1 for t in tasks if t.get("status") == "BLOCKED")
    in_progress_tasks = sum(1 for t in tasks if t.get("status") == "IN_PROGRESS")

    if total_tasks == 0:
        logger.info("Onboarding status query: company=%s stage=DEAL deal_status=%s (no tasks)",
                    lead["company_name"], deal.get("status"))
        return {
            "found": True,
            "stage": "DEAL",
            "company_name": lead["company_name"],
            "deal_status": deal.get("status"),
            "message": f"{lead['company_name']} deal is {deal.get('status')} but onboarding has not started.",
        }

    progress = round((done_tasks / total_tasks) * 100) if total_tasks > 0 else 0
    active_task = next(
        (t for t in tasks if t.get("status") in ("IN_PROGRESS",)),
        next((t for t in tasks if t.get("status") == "OPEN"), None),
    )

    logger.info(
        "Onboarding status query: company=%s stage=ONBOARDING progress=%d%% done=%d/%d blocked=%d",
        lead["company_name"], progress, done_tasks, total_tasks, blocked_tasks,
    )

    return {
        "found": True,
        "stage": "ONBOARDING",
        "company_name": lead["company_name"],
        "deal_status": deal.get("status"),
        "total_tasks": total_tasks,
        "done_tasks": done_tasks,
        "in_progress_tasks": in_progress_tasks,
        "blocked_tasks": blocked_tasks,
        "progress": progress,
        "active_task": active_task,
        "tasks": tasks,
        "message": _build_status_message(
            lead["company_name"], done_tasks, total_tasks, blocked_tasks,
            progress, active_task,
        ),
    }


def _build_status_message(company, done, total, blocked, progress, active_task) -> str:
    if progress == 100:
        return f"{company} has been fully onboarded. All {total} onboarding tasks are complete."
    parts = [f"{company} is currently onboarding.", ""]
    parts.append(f"{done} of {total} onboarding tasks are complete.")
    parts.append(f"Progress: {progress}%.")
    if blocked:
        parts.append(f"Warning: {blocked} task(s) are currently BLOCKED.")
    if active_task:
        parts.append("")
        parts.append(f"Current active task:")
        parts.append(f"{active_task['task_name']} — {active_task['status']}")
    return "\n".join(parts)
