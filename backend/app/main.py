from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import CORS_ORIGINS, GROQ_API_KEY, DB_PATH
from app.database.database import init_db, get_connection
from app.schemas.schemas import (
    ChatRequest, ChatResponse, TaskStatusUpdate, HealthResponse,
)
from app.router.router import classify_intent

from app.workflows.main_graph import app_graph
from app.tools.lead_tools import get_all_leads, get_lead_by_id
from app.tools.deal_tools import (
    get_all_deals, get_deal_with_lead, get_deal_by_id,
    create_deal, mark_deal_won,
)
from app.tools.task_tools import (
    get_all_tasks, get_tasks_for_deal, update_task_status,
    create_onboarding_tasks, tasks_exist_for_deal,
)
from app.tools.status_tools import get_onboarding_status
from app.tools.chat_tools import (
    init_chat_table, save_message, get_chat_history, clear_chat_history,
)
from app.logging_config import get_logger
import json
import os

logger = get_logger(__name__)

APP_VERSION = "1.0.0"


def _validate_startup() -> None:
    """Run critical startup validations and log findings."""
    warnings = []

    if not GROQ_API_KEY:
        warnings.append("GROQ_API_KEY is not set; LLM features will fail.")
    else:
        logger.info("GROQ_API_KEY configured (model %s)", os.getenv("GROQ_MODEL"))

    try:
        with get_connection() as conn:
            conn.execute("SELECT 1")
        logger.info("Database connectivity OK: %s", DB_PATH)
    except Exception as e:
        raise RuntimeError(f"Database connectivity failed for {DB_PATH}: {e}") from e

    for w in warnings:
        logger.warning("Startup warning: %s", w)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Lead-to-Delivery AI Agent v%s", APP_VERSION)
    _validate_startup()
    init_db()
    init_chat_table()
    logger.info("Startup complete.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Lead-to-Delivery AI Agent",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    db_status = "OK"
    try:
        with get_connection() as conn:
            conn.execute("SELECT 1")
    except Exception as e:
        db_status = f"ERROR: {e}"
        logger.error("Health check DB failure: %s", e)
    return HealthResponse(
        status="OK" if db_status == "OK" else "DEGRADED",
        version=APP_VERSION,
        database=db_status,
        llm_configured=bool(GROQ_API_KEY),
    )


# ── Chat / Agent entry point ─────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Main natural language entry point.
    Classifies intent and routes to the correct workflow.
    """
    thread_id = request.thread_id or "default_thread"
    message = (request.message or "").strip()

    if not message:
        raise HTTPException(status_code=400, detail="message cannot be empty")

    logger.info("Chat request thread_id=%s length=%d", thread_id, len(message))

    try:
        save_message(
            role="user",
            content=message,
            thread_id=thread_id,
        )
    except Exception as e:
        logger.warning("Failed to persist user message for thread_id=%s: %s",
                       thread_id, e)

    try:
        final_state = app_graph.invoke(
            {"message": message},
            config={"configurable": {"thread_id": thread_id}},
        )

        response_text = final_state.get("final_response", "")
        intent = final_state.get("intent", "UNKNOWN")
        trace = final_state.get("execution_trace", [])
        data = final_state.get("data", {})

        try:
            save_message(
                role="assistant",
                content=response_text,
                thread_id=thread_id,
                intent=intent,
                trace_json=json.dumps(trace, default=str) if trace else None,
            )
        except Exception as e:
            logger.warning("Failed to persist assistant message for thread_id=%s: %s",
                           thread_id, e)

        logger.info("Chat response thread_id=%s intent=%s", thread_id, intent)

        return ChatResponse(
            response=response_text,
            intent=intent,
            execution_trace=trace,
            data=data,
        )
    except Exception as e:
        logger.exception("Chat endpoint error for thread_id=%s", thread_id)
        raise HTTPException(status_code=500, detail=f"Internal processing error: {type(e).__name__}")


# ── Leads ────────────────────────────────────────────────────────────────────

@app.get("/api/leads")
async def get_leads():
    try:
        return {"leads": get_all_leads()}
    except Exception as e:
        logger.exception("Failed to fetch leads")
        raise HTTPException(status_code=500, detail="Failed to fetch leads")


@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: int):
    if lead_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid lead_id")
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"lead": lead}


# ── Deals ────────────────────────────────────────────────────────────────────

@app.get("/api/deals")
async def get_deals():
    try:
        return {"deals": get_all_deals()}
    except Exception as e:
        logger.exception("Failed to fetch deals")
        raise HTTPException(status_code=500, detail="Failed to fetch deals")


@app.get("/api/deals/{deal_id}")
async def get_deal(deal_id: int):
    if deal_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid deal_id")
    deal = get_deal_with_lead(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal["tasks"] = get_tasks_for_deal(deal_id)
    return {"deal": deal}


@app.post("/api/deals/{deal_id}/won")
async def mark_deal_won_endpoint(deal_id: int):
    if deal_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid deal_id")

    deal = get_deal_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    lead = get_lead_by_id(deal["lead_id"])
    if not lead:
        raise HTTPException(status_code=404, detail="Lead for deal not found")

    mark_deal_won(deal_id)

    if tasks_exist_for_deal(deal_id):
        tasks = get_tasks_for_deal(deal_id)
        logger.info("Deal %s already had onboarding tasks (%d total) for company=%s",
                    deal_id, len(tasks), lead.get("company_name"))
        return {
            "status": "success",
            "data": {
                "status": "ALREADY_ONBOARDING",
                "deal_id": deal_id,
                "lead_id": lead["id"],
                "tasks": tasks,
                "message": f"{lead['company_name']} already has an onboarding plan with {len(tasks)} tasks.",
            },
        }

    tasks = create_onboarding_tasks(deal_id, lead)

    logger.info("Deal_id=%s marked WON for company=%s; %d tasks created",
                deal_id, lead.get("company_name"), len(tasks))

    return {
        "status": "success",
        "data": {
            "status": "SUCCESS",
            "deal_id": deal_id,
            "lead_id": lead["id"],
            "tasks": tasks,
            "message": (
                f"Deal marked as WON for {lead['company_name']}.\n\n"
                f"{len(tasks)} onboarding tasks created:\n" +
                "\n".join(f"• {t['task_name']} — {t['priority']}" for t in tasks)
            ),
        },
    }


@app.get("/api/deals/{deal_id}/status")
async def get_deal_status(deal_id: int):
    if deal_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid deal_id")
    deal = get_deal_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    lead = get_lead_by_id(deal["lead_id"])
    if not lead:
        raise HTTPException(status_code=404, detail="Lead for deal not found")

    status_data = get_onboarding_status(lead["company_name"])
    return {"status": status_data}


# ── Tasks ────────────────────────────────────────────────────────────────────

@app.get("/api/tasks")
async def get_tasks():
    try:
        return {"tasks": get_all_tasks()}
    except Exception as e:
        logger.exception("Failed to fetch tasks")
        raise HTTPException(status_code=500, detail="Failed to fetch tasks")


@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: int, status_update: TaskStatusUpdate):
    if task_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid task_id")

    result = update_task_status(task_id, status_update.status)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return {"status": "success", "data": result}


# ── Chat History ─────────────────────────────────────────────────────────────

@app.get("/api/chat/history")
async def chat_history(thread_id: str = "default_thread", limit: int = 50):
    if limit <= 0 or limit > 500:
        limit = 50
    try:
        return {
            "thread_id": thread_id,
            "messages": get_chat_history(thread_id=thread_id, limit=limit),
        }
    except Exception as e:
        logger.exception("Failed to fetch chat history for thread_id=%s", thread_id)
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")


@app.delete("/api/chat/history")
async def clear_history(thread_id: str = "default_thread"):
    try:
        removed = clear_chat_history(thread_id=thread_id)
        logger.info("Cleared chat history for thread_id=%s removed=%d", thread_id, removed)
        return {"status": "success", "removed": removed}
    except Exception as e:
        logger.exception("Failed to clear chat history for thread_id=%s", thread_id)
        raise HTTPException(status_code=500, detail="Failed to clear chat history")
