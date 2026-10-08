from app.services.llm_service import call_llm_json
from app.logging_config import get_logger

logger = get_logger(__name__)

ROUTER_SYSTEM = """
You are a message router for a Sales and Operations AI assistant used by employees.

IMPORTANT CONTEXT:
- Leads are created via a dedicated form (NOT via chat).
- Deals are confirmed via a dedicated button (NOT via chat).
- The chat assistant is ONLY for querying/retrieving business information.

Classify the employee's message into EXACTLY one of these intents:

1. STATUS_QUERY   - Asking about a lead status, deal status, or onboarding status for a company
2. TASK_UPDATE    - Requesting a task status change (e.g., mark as done, start, in progress)
3. LEAD_QUERY     - Asking about lead details, scores, tiers, or pipeline (e.g., "show me HOT leads", "why is X a HOT lead")
4. DEAL_QUERY     - Asking about deals, won deals, deal values
5. TASK_QUERY     - Asking about tasks, pending tasks, high-priority tasks, onboarding progress
6. GENERAL_QUERY  - Any other business information query

Return ONLY a JSON object with this exact structure:
{
  "intent": "STATUS_QUERY",
  "confidence": 0.95,
  "entity": "Company Name or null"
}

Rules:
- intent must be one of: STATUS_QUERY, TASK_UPDATE, LEAD_QUERY, DEAL_QUERY, TASK_QUERY, GENERAL_QUERY
- confidence is a float between 0.0 and 1.0
- entity is the company name if mentioned, otherwise null
- Do NOT include any explanation or additional text
- If the employee tries to create a lead or confirm a deal, classify as GENERAL_QUERY and note that these actions must be done via the UI form/button
"""

VALID_INTENTS = frozenset({
    "STATUS_QUERY", "TASK_UPDATE", "LEAD_QUERY",
    "DEAL_QUERY", "TASK_QUERY", "GENERAL_QUERY",
})
DEFAULT_INTENT = "GENERAL_QUERY"

# Legacy intent mapping for backward compatibility with the LangGraph workflow
LEGACY_INTENT_MAP = {
    "LEAD_QUERY": "STATUS_QUERY",
    "DEAL_QUERY": "STATUS_QUERY",
    "TASK_QUERY": "STATUS_QUERY",
    "GENERAL_QUERY": "STATUS_QUERY",
    "STATUS_QUERY": "STATUS_QUERY",
    "TASK_UPDATE": "TASK_UPDATE",
}


def classify_intent(message: str) -> dict:
    """
    Classify a user message into one of the supported chat assistant intents.
    Returns dict: {intent, confidence, entity}
    """
    if not message or not isinstance(message, str):
        logger.warning("Empty or invalid message passed to classify_intent; defaulting to GENERAL_QUERY")
        return {"intent": DEFAULT_INTENT, "confidence": 0.0, "entity": None}

    try:
        result = call_llm_json(ROUTER_SYSTEM, message)
    except Exception as e:
        logger.warning("LLM intent classification failed (%s: %s); defaulting to GENERAL_QUERY",
                       type(e).__name__, e)
        return {"intent": DEFAULT_INTENT, "confidence": 0.0, "entity": None}

    if not isinstance(result, dict):
        logger.warning("Router LLM returned non-dict; defaulting to GENERAL_QUERY. Raw: %r", result)
        return {"intent": DEFAULT_INTENT, "confidence": 0.0, "entity": None}

    raw_intent = (result.get("intent") or DEFAULT_INTENT).strip().upper()
    if raw_intent not in VALID_INTENTS:
        logger.warning("Router returned invalid intent=%r; defaulting to GENERAL_QUERY", raw_intent)
        intent = DEFAULT_INTENT
    else:
        intent = raw_intent

    try:
        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.5

    entity = result.get("entity")
    if isinstance(entity, str):
        entity = entity.strip() or None

    logger.debug("Router classified message: intent=%s confidence=%.2f entity=%s",
                 intent, confidence, entity)
    return {"intent": intent, "confidence": confidence, "entity": entity}
