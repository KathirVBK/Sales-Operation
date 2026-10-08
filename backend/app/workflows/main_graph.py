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
from app.agents.operations_agent import _handle_deal_won, _handle_task_update, run_status_query
from app.services.execution_service import log_step
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
    intent = state.get("intent", "NEW_LEAD")
    valid = {"NEW_LEAD", "DEAL_WON", "TASK_UPDATE", "STATUS_QUERY"}
    if intent not in valid:
        logger.warning("Graph route_intent: unexpected intent=%r, using NEW_LEAD", intent)
        return "NEW_LEAD"
    return intent


def sales_agent_node(state: AgentState):
    intent = state.get("intent", "NEW_LEAD")
    existing_lead = state.get("extracted_lead")
    agent_result = run_sales_agent(state["message"], existing_lead)
    status = agent_result.get("status", "ERROR")

    trace = []

    if status == "QUALIFIED":
        trace.append(log_step(intent, "Sales Agent", "Extract Information", "Lead data extracted successfully"))
        trace.append(log_step(intent, "Validation", "Check Required Fields", "All required information complete"))

        score_val = agent_result.get("score_result", {}).get("score", 0)
        tier_val = agent_result.get("score_result", {}).get("tier", "COLD")

        trace.append(log_step(intent, "Scoring Tool", "Calculate Score", f"Score: {score_val}"))
        trace.append(log_step(intent, "Sales Agent", "Assign Tier", f"Tier: {tier_val}"))
        trace.append(log_step(intent, "Sales Agent", "Outreach", "Draft generated"))
        trace.append(log_step(intent, "Database", "Save Lead", "Saved to SQLite"))

    elif status == "NEEDS_CLARIFICATION":
        trace.append(log_step(intent, "Sales Agent", "Extract Information", "Partial lead data extracted"))
        missing = ", ".join(agent_result.get("missing_fields", []))
        trace.append(log_step(intent, "Validation", "Check Required Fields", f"Missing information: {missing}"))
        trace.append(log_step(intent, "Sales Agent", "Clarification", "Asked user for missing details"))

    elif status == "ERROR":
        trace.append(log_step(intent, "Sales Agent", "Error", agent_result.get("message", "Unknown error")))

    return {
        "final_response": agent_result.get("message", ""),
        "execution_trace": trace,
        "data": agent_result,
        "extracted_lead": agent_result.get("lead"),
    }


def deal_won_node(state: AgentState):
    intent = state.get("intent", "DEAL_WON")
    result = _handle_deal_won(state["message"])
    status = result.get("status")

    trace = []
    if status == "SUCCESS":
        trace.append(log_step(intent, "Operations Agent", "Find Lead & Deal", "Lead and deal identified"))
        trace.append(log_step(intent, "Operations Agent", "Mark Won", "Deal marked as won"))
        trace.append(log_step(intent, "Operations Agent", "Create Tasks", "Onboarding tasks created"))
    elif status == "ALREADY_ONBOARDING":
        trace.append(log_step(intent, "Operations Agent", "Duplicate Check", "Deal already onboarding"))
    else:
        trace.append(log_step(intent, "Operations Agent", "Error", result.get("message", "Unknown error")))

    return {
        "final_response": result.get("message", ""),
        "execution_trace": trace,
        "data": result,
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


def status_query_node(state: AgentState):
    intent = state.get("intent", "STATUS_QUERY")
    result = run_status_query(state["message"])
    status = result.get("status")

    trace = []
    if status == "SUCCESS":
        trace.append(log_step(intent, "Operations Agent", "Query Status", "Retrieved onboarding status"))
    else:
        trace.append(log_step(intent, "Operations Agent", "Error", result.get("message", "Unknown error")))

    return {
        "final_response": result.get("message", ""),
        "execution_trace": trace,
        "data": result.get("data", {}),
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
workflow.add_node("sales_agent", sales_agent_node)
workflow.add_node("deal_won", deal_won_node)
workflow.add_node("task_update", task_update_node)
workflow.add_node("status_query", status_query_node)

workflow.add_edge(START, "router")
workflow.add_conditional_edges(
    "router",
    route_intent,
    {
        "NEW_LEAD": "sales_agent",
        "DEAL_WON": "deal_won",
        "TASK_UPDATE": "task_update",
        "STATUS_QUERY": "status_query",
    },
)
workflow.add_edge("sales_agent", END)
workflow.add_edge("deal_won", END)
workflow.add_edge("task_update", END)
workflow.add_edge("status_query", END)

memory = _build_checkpointer()
app_graph = workflow.compile(checkpointer=memory)
