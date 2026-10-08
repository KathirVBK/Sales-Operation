from typing import TypedDict, Annotated, Optional, List, Any
import operator
import sqlite3
from pathlib import Path
import os
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from app.database.database import DB_PATH

from app.router.router import classify_intent
from app.agents.sales_agent import run_sales_agent
from app.agents.operations_agent import _handle_task_update, run_status_query
from app.services.execution_service import log_step
from app.tools.lead_tools import get_all_leads, get_lead_by_company
from app.tools.deal_tools import get_all_deals, get_deal_by_company
from app.tools.task_tools import get_all_tasks
from app.logging_config import get_logger

logger = get_logger(__name__)


class AgentState(TypedDict):
    message: str
    intent: Optional[str]
    confidence: Optional[float]
    entity: Optional[str]
    extracted_lead: Optional[dict]
    execution_trace: Annotated[List[dict], operator.add]
    final_response: Optional[str]
    data: Optional[dict]


def router_node(state: AgentState):
    classification = classify_intent(state["message"])
    intent = classification["intent"]
    trace = [log_step(intent, "Router", "Intent classified", intent)]
    return {
        "intent": intent,
        "confidence": classification["confidence"],
        "entity": classification["entity"],
        "execution_trace": trace,
    }


def route_intent(state: AgentState) -> str:
    intent = state.get("intent", "GENERAL_QUERY")
    valid = {
        "STATUS_QUERY", "TASK_UPDATE",
        "LEAD_QUERY", "DEAL_QUERY", "TASK_QUERY", "GENERAL_QUERY",
    }
    if intent not in valid:
        logger.warning("Graph route_intent: unexpected intent=%r, using GENERAL_QUERY", intent)
        return "GENERAL_QUERY"
    return intent


def query_node(state: AgentState):
    """
    Handles LEAD_QUERY, DEAL_QUERY, TASK_QUERY, and GENERAL_QUERY intents.
    Retrieves relevant data from the database and generates a natural language response.
    """
    intent = state.get("intent", "GENERAL_QUERY")
    message = state.get("message", "")
    entity = state.get("entity")

    trace = []
    response_text = ""
    data_out = {}

    try:
        if intent == "LEAD_QUERY":
            trace.append(log_step(intent, "Sales Agent", "Query Leads", "Fetching lead data"))
            leads = get_all_leads()

            # Filter based on the entity (company name) if provided
            if entity:
                leads = [l for l in leads if entity.lower() in (l.get("company_name") or "").lower()]

            msg_lower = message.lower()

            # Smart filtering based on message content
            if any(kw in msg_lower for kw in ["high", "medium", "low"]):
                for tier in ["HIGH", "MEDIUM", "LOW"]:
                    if tier.lower() in msg_lower:
                        leads = [l for l in leads if l.get("tier") == tier]
                        break

            if "score above" in msg_lower or "score >" in msg_lower:
                # Try to extract score threshold
                import re
                nums = re.findall(r'\d+', msg_lower)
                if nums:
                    threshold = int(nums[-1])
                    leads = [l for l in leads if (l.get("score") or 0) >= threshold]

            if not leads:
                response_text = "No matching leads found."
            else:
                lines = [f"Lead Pipeline ({len(leads)} lead(s)):\n"]
                for l in leads:
                    budget_str = f"\u20b9{l['budget']:,.0f}" if l.get("budget") else "N/A"
                    lines.append(
                        f"\n{l['company_name']}\n"
                        f"  Contact: {l.get('contact_name') or 'N/A'}\n"
                        f"  Requirement: {l.get('need') or 'N/A'}\n"
                        f"  Budget: {budget_str}\n"
                        f"  Timeline: {l.get('timeline') or 'N/A'}\n"
                        f"  Score: {l.get('score') or 'N/A'}/100 | Tier: {l.get('tier') or 'N/A'}\n"
                        f"  Status: {l.get('status') or 'N/A'}"
                    )
                response_text = "\n".join(lines)
            data_out = {"leads": leads}
            trace.append(log_step(intent, "Database", "Fetch Leads", f"Retrieved {len(leads)} leads"))

        elif intent == "DEAL_QUERY":
            trace.append(log_step(intent, "Operations Agent", "Query Deals", "Fetching deal data"))
            deals = get_all_deals()

            if entity:
                deals = [d for d in deals if entity.lower() in (d.get("company_name") or "").lower()]

            msg_lower = message.lower()
            if "won" in msg_lower:
                deals = [d for d in deals if d.get("status") == "WON"]

            if not deals:
                response_text = "No matching deals found."
            else:
                lines = [f"Contracts ({len(deals)} contract(s)):\n"]
                for d in deals:
                    val = f"\u20b9{d['deal_value']:,.0f}" if d.get("deal_value") else "TBD"
                    lines.append(
                        f"\n{d.get('company_name', 'Unknown')} (Contract #{d['id']})\n"
                        f"  Value: {val}\n"
                        f"  Status: {d.get('status')}\n"
                        f"  Lead Score: {d.get('score') or 'N/A'} ({d.get('tier') or '-'})\n"
                        f"  Won At: {d.get('won_at') or 'N/A'}"
                    )
                response_text = "\n".join(lines)
            data_out = {"deals": deals}
            trace.append(log_step(intent, "Database", "Fetch Deals", f"Retrieved {len(deals)} deals"))

        elif intent == "TASK_QUERY":
            trace.append(log_step(intent, "Operations Agent", "Query Tasks", "Fetching task data"))
            tasks = get_all_tasks()

            if entity:
                tasks = [t for t in tasks if entity.lower() in (t.get("company_name") or "").lower()]

            msg_lower = message.lower()
            if "pending" in msg_lower or "open" in msg_lower:
                tasks = [t for t in tasks if t.get("status") in ("OPEN", "BLOCKED")]
            elif "completed" in msg_lower or "done" in msg_lower:
                tasks = [t for t in tasks if t.get("status") == "DONE"]
            elif "in progress" in msg_lower or "in_progress" in msg_lower:
                tasks = [t for t in tasks if t.get("status") == "IN_PROGRESS"]

            if "high" in msg_lower and "priority" in msg_lower:
                tasks = [t for t in tasks if t.get("priority") == "HIGH"]

            if not tasks:
                response_text = "No matching tasks found."
            else:
                lines = [f"Tasks ({len(tasks)} task(s)):\n"]
                for t in tasks:
                    lines.append(
                        f"  • [{t.get('status')}] {t.get('task_name')} "
                        f"— {t.get('priority')} priority "
                        f"({t.get('company_name', 'Unknown')})"
                    )
                response_text = "\n".join(lines)
            data_out = {"tasks": tasks}
            trace.append(log_step(intent, "Database", "Fetch Tasks", f"Retrieved {len(tasks)} tasks"))

        elif intent == "STATUS_QUERY":
            # Delegate to existing status query handler
            from app.agents.operations_agent import run_status_query
            result = run_status_query(message)
            response_text = result.get("message", "")
            data_out = result.get("data", {})
            trace.append(log_step(intent, "Operations Agent", "Query Status", "Retrieved onboarding status"))

        else:
            # GENERAL_QUERY fallback
            response_text = (
                "I can help you find information about leads, contracts, and operational tasks.\n\n"
                "Try asking:\n"
                "• \"Show me all HIGH leads\"\n"
                "• \"What are the details of [Company Name]?\"\n"
                "• \"Which leads have a score above 80?\"\n"
                "• \"What contracts are active?\"\n"
                "• \"Show me pending high-priority tasks\"\n\n"
                "Note: To create a new lead, use the Lead Pipeline → + Create Lead button.\n"
                "To confirm a contract, use the Confirm Contract button on the lead card."
            )
            trace.append(log_step(intent, "Chat Assistant", "General Help", "Provided guidance"))

    except Exception as e:
        logger.exception("query_node error for intent=%s", intent)
        response_text = f"I encountered an error while retrieving that information: {type(e).__name__}"
        trace.append(log_step(intent, "Chat Assistant", "Error", str(e)))

    return {
        "final_response": response_text,
        "execution_trace": trace,
        "data": data_out,
    }


def task_update_node(state: AgentState):
    intent = state.get("intent", "TASK_UPDATE")
    result = _handle_task_update(state["message"])
    status = result.get("status")

    trace = []
    if status == "SUCCESS":
        trace.append(log_step(intent, "Operations Agent", "Update Task", result.get("message", "")))
    else:
        trace.append(log_step(intent, "Operations Agent", "Error", result.get("message", "Unknown error")))

    return {
        "final_response": result.get("message", ""),
        "execution_trace": trace,
        "data": result,
    }


def _build_checkpointer() -> SqliteSaver:
    """Create the SQLite checkpointer with error handling and directory creation."""
    try:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    except Exception:
        pass
    try:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        memory = SqliteSaver(conn)
        try:
            memory.setup()
        except Exception as setup_err:
            logger.warning("LangGraph SqliteSaver.setup() raised (non-fatal): %s", setup_err)
        logger.info("LangGraph checkpointer ready (conn=%s)", DB_PATH)
        return memory
    except Exception as e:
        logger.error("Failed to build LangGraph checkpointer: %s", e)
        raise


workflow = StateGraph(AgentState)

workflow.add_node("router", router_node)
workflow.add_node("query", query_node)
workflow.add_node("task_update", task_update_node)

workflow.add_edge(START, "router")
workflow.add_conditional_edges(
    "router",
    route_intent,
    {
        "STATUS_QUERY": "query",
        "LEAD_QUERY": "query",
        "DEAL_QUERY": "query",
        "TASK_QUERY": "query",
        "GENERAL_QUERY": "query",
        "TASK_UPDATE": "task_update",
    },
)
workflow.add_edge("query", END)
workflow.add_edge("task_update", END)

memory = _build_checkpointer()
app_graph = workflow.compile(checkpointer=memory)
