"""
Operations workflow orchestrating the Operations Agent and Execution Trace.
"""
from app.agents.operations_agent import run_operations_agent, run_status_query
from app.services.execution_service import log_step


def handle_deal_won(message: str) -> dict:
    trace = []
    trace.append(log_step("DEAL_WON", "Router", "Intent classified", "DEAL_WON"))
    
    agent_result = run_operations_agent(message, sub_intent="DEAL_WON")
    
    status = agent_result["status"]
    
    if status == "SUCCESS":
        trace.append(log_step("DEAL_WON", "Operations Agent", "Identify Deal", "Deal identified from company name"))
        trace.append(log_step("DEAL_WON", "Validation", "Deal exists", "Lead and deal records validated"))
        num_tasks = len(agent_result.get("tasks", []))
        trace.append(log_step("DEAL_WON", "Operations Agent", "Create Tasks", f"{num_tasks} onboarding tasks created"))
        trace.append(log_step("DEAL_WON", "Database", "Save Tasks", "Tasks saved to SQLite"))
    elif status == "ALREADY_ONBOARDING":
        trace.append(log_step("DEAL_WON", "Operations Agent", "Identify Deal", "Deal identified from company name"))
        trace.append(log_step("DEAL_WON", "Validation", "Duplicate Check", "Deal is already onboarding"))
    elif status == "ERROR":
        trace.append(log_step("DEAL_WON", "Operations Agent", "Error", agent_result["message"]))

    return {
        "response": agent_result["message"],
        "intent": "DEAL_WON",
        "execution_trace": trace,
        "data": agent_result
    }


def handle_task_update(message: str) -> dict:
    trace = []
    trace.append(log_step("TASK_UPDATE", "Router", "Intent classified", "TASK_UPDATE"))
    
    agent_result = run_operations_agent(message, sub_intent="TASK_UPDATE")
    
    if agent_result["status"] == "SUCCESS":
        update = agent_result["task_update"]
        trace.append(log_step("TASK_UPDATE", "Operations Agent", "Identify Task", f"Identified task: {update['task']}"))
        trace.append(log_step("TASK_UPDATE", "Validation", "Transition Check", f"Validated {update['old_status']} -> {update['new_status']}"))
        trace.append(log_step("TASK_UPDATE", "Database", "Update Task", "Task status updated in SQLite"))
    else:
        trace.append(log_step("TASK_UPDATE", "Operations Agent", "Error", agent_result["message"]))
        
    return {
        "response": agent_result["message"],
        "intent": "TASK_UPDATE",
        "execution_trace": trace,
        "data": agent_result
    }


def handle_status_query(message: str) -> dict:
    trace = []
    trace.append(log_step("STATUS_QUERY", "Router", "Intent classified", "STATUS_QUERY"))
    
    agent_result = run_status_query(message)
    
    if agent_result["status"] == "SUCCESS":
        trace.append(log_step("STATUS_QUERY", "Operations Agent", "Identify Company", "Company identified from query"))
        trace.append(log_step("STATUS_QUERY", "Database", "Read Status", "Tasks and onboarding status read from SQLite"))
    else:
        trace.append(log_step("STATUS_QUERY", "Operations Agent", "Error", agent_result["message"]))

    return {
        "response": agent_result["message"],
        "intent": "STATUS_QUERY",
        "execution_trace": trace,
        "data": agent_result
    }
