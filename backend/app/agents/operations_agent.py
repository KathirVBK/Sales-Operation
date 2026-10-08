"""
Operations Agent: validates deals, creates onboarding tasks, handles task updates.
"""
from app.services.llm_service import call_llm_json
from app.tools.lead_tools import get_lead_by_company, get_lead_by_id
from app.tools.deal_tools import (
    get_deal_by_company, create_deal, mark_deal_won, get_deal_by_id,
)
from app.tools.task_tools import (
    create_onboarding_tasks, tasks_exist_for_deal,
    find_task_by_name_and_company, update_task_status, get_tasks_for_deal,
)
from app.tools.status_tools import get_onboarding_status
from app.logging_config import get_logger

logger = get_logger(__name__)

DEAL_EXTRACT_SYSTEM = """
Extract the company name and deal value (if mentioned) from the message.
Return ONLY JSON:
{
  "company_name": "string",
  "deal_value": number or null
}
"""

TASK_EXTRACT_SYSTEM = """
Extract the task name and new status from the user's message.
The new status must be one of: IN_PROGRESS, DONE, BLOCKED, OPEN
Return ONLY JSON:
{
  "company_name": "string or null",
  "task_name": "string",
  "new_status": "DONE"
}
Map phrases like 'mark as done', 'complete', 'finish' → DONE
'start', 'begin', 'in progress' → IN_PROGRESS
'blocked', 'stuck' → BLOCKED
"""

STATUS_EXTRACT_SYSTEM = """
Extract the company name from the user's status query.
Return ONLY JSON:
{
  "company_name": "string"
}
"""


def run_operations_agent(message: str, sub_intent: str = "DEAL_WON") -> dict:
    """
    Handles DEAL_WON, TASK_UPDATE intents.
    """
    try:
        if sub_intent == "DEAL_WON":
            return _handle_deal_won(message)
        if sub_intent == "TASK_UPDATE":
            return _handle_task_update(message)
        logger.error("Unknown operations sub_intent=%r", sub_intent)
        return {"status": "ERROR", "message": f"Unknown sub_intent: {sub_intent}"}
    except Exception as e:
        logger.exception("Operations Agent error for sub_intent=%s", sub_intent)
        return {"status": "ERROR", "message": f"Operations Agent error: {type(e).__name__}"}


def _handle_deal_won(message: str) -> dict:
    try:
        extracted = call_llm_json(DEAL_EXTRACT_SYSTEM, message)
    except Exception as e:
        logger.warning("LLM deal extraction failed: %s", e)
        extracted = {}
    if not isinstance(extracted, dict):
        extracted = {}

    company_name = (extracted.get("company_name") or "").strip()
    deal_value = extracted.get("deal_value")

    if not company_name:
        logger.warning("DEAL_WON handler: could not extract company name from message")
        return {
            "status": "ERROR",
            "message": "Could not identify the company name. Please specify which company accepted the deal.",
        }

    lead = get_lead_by_company(company_name)
    if not lead:
        logger.warning("DEAL_WON handler: no lead found for company=%s", company_name)
        return {
            "status": "ERROR",
            "message": f"No lead found for '{company_name}'. Please make sure the lead was created first.",
        }

    deal = get_deal_by_company(company_name)
    if not deal:
        deal_id = create_deal(lead["id"], deal_value)
        deal = get_deal_by_id(deal_id)
        logger.info("DEAL_WON handler: created deal_id=%s for lead_id=%s company=%s",
                    deal_id, lead["id"], company_name)
    else:
        deal_id = deal["id"]

    mark_deal_won(deal_id)

    if tasks_exist_for_deal(deal_id):
        tasks = get_tasks_for_deal(deal_id)
        logger.info("DEAL_WON handler: deal_id=%s already onboarding (%d tasks) for company=%s",
                    deal_id, len(tasks), company_name)
        return {
            "status": "ALREADY_ONBOARDING",
            "message": f"{lead['company_name']} already has an onboarding plan with {len(tasks)} tasks.",
            "deal_id": deal_id,
            "lead_id": lead["id"],
            "tasks": tasks,
        }

    tasks = create_onboarding_tasks(deal_id, lead)

    logger.info("DEAL_WON handler: deal_id=%s marked WON company=%s tasks_created=%d",
                deal_id, lead["company_name"], len(tasks))

    return {
        "status": "SUCCESS",
        "message": (
            f"Contract confirmed for {lead['company_name']}.\n\n"
            f"{len(tasks)} onboarding tasks created:\n" +
            "\n".join(f"• {t['task_name']} — {t['priority']}" for t in tasks)
        ),
        "deal_id": deal_id,
        "lead_id": lead["id"],
        "tasks": tasks,
    }


def _handle_task_update(message: str) -> dict:
    try:
        extracted = call_llm_json(TASK_EXTRACT_SYSTEM, message)
    except Exception as e:
        logger.warning("LLM task update extraction failed: %s", e)
        extracted = {}
    if not isinstance(extracted, dict):
        extracted = {}

    company_name = (extracted.get("company_name") or "").strip()
    task_name = (extracted.get("task_name") or "").strip()
    new_status = (str(extracted.get("new_status") or "")).strip().upper()

    if not task_name or not new_status:
        logger.warning("TASK_UPDATE handler: missing task_name or new_status")
        return {
            "status": "ERROR",
            "message": "Could not identify the task or new status from your message.",
        }

    task = find_task_by_name_and_company(task_name, company_name)
    if not task:
        logger.warning(
            "TASK_UPDATE handler: task not found task_name=%s company=%s",
            task_name, company_name,
        )
        return {
            "status": "ERROR",
            "message": f"Could not find task '{task_name}' for '{company_name}'. Please check the task name.",
        }

    result = update_task_status(task["id"], new_status)

    if result["success"]:
        logger.info(
            "TASK_UPDATE handler: success task_id=%s company=%s %s -> %s",
            task["id"], company_name, result["old_status"], result["new_status"],
        )
        return {
            "status": "SUCCESS",
            "message": f"Task '{result['task']}' updated from {result['old_status']} to {result['new_status']}.",
            "task_update": result,
        }
    return {"status": "ERROR", "message": result["message"]}


def run_status_query(message: str) -> dict:
    """Handle STATUS_QUERY intent."""
    try:
        try:
            extracted = call_llm_json(STATUS_EXTRACT_SYSTEM, message)
        except Exception as e:
            logger.warning("LLM status query extraction failed: %s", e)
            extracted = {}
        if not isinstance(extracted, dict):
            extracted = {}

        company_name = (extracted.get("company_name") or "").strip()
        if not company_name:
            logger.warning("STATUS_QUERY handler: no company name extracted")
            return {
                "status": "ERROR",
                "message": "Could not identify the company name from your query.",
                "data": {},
            }
        status_data = get_onboarding_status(company_name)
        logger.info("STATUS_QUERY handler: returning status for company=%s found=%s stage=%s",
                    company_name, status_data.get("found"), status_data.get("stage"))
        return {
            "status": "SUCCESS",
            "message": status_data.get("message", ""),
            "data": status_data,
        }
    except Exception as e:
        logger.exception("Status query error")
        return {
            "status": "ERROR",
            "message": f"Status query error: {type(e).__name__}",
            "data": {},
        }
