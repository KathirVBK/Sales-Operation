"""
Sales workflow orchestrating the Sales Agent and Execution Trace.
"""
from app.agents.sales_agent import run_sales_agent
from app.services.execution_service import log_step, build_trace
from app.schemas.schemas import ChatResponse


def handle_new_lead(message: str) -> dict:
    """Orchestrates NEW_LEAD intent."""
    trace = []
    trace.append(log_step("NEW_LEAD", "Router", "Intent classified", "NEW_LEAD"))

    # Currently we don't maintain conversation state in memory for this demo.
    # We just run the agent which extracts, scores, and saves.
    # (If we wanted to support multi-turn clarification, we'd pass in existing_lead state here).
    
    agent_result = run_sales_agent(message)
    
    status = agent_result["status"]
    
    if status == "QUALIFIED":
        trace.append(log_step("NEW_LEAD", "Sales Agent", "Extract Information", "Lead data extracted successfully"))
        trace.append(log_step("NEW_LEAD", "Validation", "Check Required Fields", "All required information complete"))
        
        score_val = agent_result["score_result"]["score"]
        tier_val = agent_result["score_result"]["tier"]
        
        trace.append(log_step("NEW_LEAD", "Scoring Tool", "Calculate Score", f"Score: {score_val}"))
        trace.append(log_step("NEW_LEAD", "Sales Agent", "Assign Tier", f"Tier: {tier_val}"))
        trace.append(log_step("NEW_LEAD", "Sales Agent", "Outreach", "Draft generated"))
        trace.append(log_step("NEW_LEAD", "Database", "Save Lead", "Saved to SQLite"))
        
    elif status == "NEEDS_CLARIFICATION":
        trace.append(log_step("NEW_LEAD", "Sales Agent", "Extract Information", "Partial lead data extracted"))
        missing = ", ".join(agent_result["missing_fields"])
        trace.append(log_step("NEW_LEAD", "Validation", "Check Required Fields", f"Missing information: {missing}"))
        trace.append(log_step("NEW_LEAD", "Sales Agent", "Clarification", "Asked user for missing details"))
        
    elif status == "ERROR":
        trace.append(log_step("NEW_LEAD", "Sales Agent", "Error", agent_result["message"]))

    return {
        "response": agent_result["message"],
        "intent": "NEW_LEAD",
        "execution_trace": trace,
        "data": agent_result
    }
