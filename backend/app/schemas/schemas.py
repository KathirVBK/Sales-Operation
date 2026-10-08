from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any, Literal
from datetime import datetime


# ── Router ──────────────────────────────────────────────────────────────────

class RouterOutput(BaseModel):
    intent: str          # NEW_LEAD | DEAL_WON | STATUS_QUERY | TASK_UPDATE
    confidence: float
    entity: Optional[str] = None


# ── Lead ─────────────────────────────────────────────────────────────────────

class LeadExtraction(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    inquiry: Optional[str] = None
    budget: Optional[float] = None
    business_need: Optional[str] = None
    timeline: Optional[str] = None
    decision_maker: Optional[bool] = None


class ScoreComponents(BaseModel):
    budget: float
    business_need: float
    timeline: float
    decision_maker: float
    company_fit: float


class ScoreResult(BaseModel):
    score: float
    tier: str            # HOT | WARM | COLD
    components: ScoreComponents
    reasons: List[str]


class OutreachDraft(BaseModel):
    subject: str
    body: str


class SalesResponse(BaseModel):
    status: str          # QUALIFIED | NEEDS_CLARIFICATION | ERROR
    message: str
    lead_id: Optional[int] = None
    lead: Optional[dict] = None
    score_result: Optional[dict] = None
    outreach: Optional[dict] = None
    missing_fields: Optional[List[str]] = None


# ── Deal ─────────────────────────────────────────────────────────────────────

class DealAction(BaseModel):
    success: bool
    message: str
    deal_id: Optional[int] = None
    lead_id: Optional[int] = None
    tasks: Optional[List[dict]] = None


# ── Task ─────────────────────────────────────────────────────────────────────

VALID_TASK_STATUSES = Literal["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"]


class TaskStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def normalize_and_validate_status(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("status must be a string")
        normalized = v.strip().upper()
        allowed = {"OPEN", "IN_PROGRESS", "BLOCKED", "DONE"}
        if normalized not in allowed:
            raise ValueError(f"status must be one of: {sorted(allowed)}")
        return normalized


class TaskAction(BaseModel):
    success: bool
    task: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    message: str


# ── Agent Response ────────────────────────────────────────────────────────────

class ExecutionStep(BaseModel):
    agent: str
    action: str
    result: str


class AgentResponse(BaseModel):
    response: str
    intent: str
    execution_trace: List[ExecutionStep] = []
    data: Optional[Any] = None


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default_thread"
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    response: str
    intent: str
    execution_trace: List[dict] = []
    data: Optional[Any] = None


# ── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    llm_configured: bool
