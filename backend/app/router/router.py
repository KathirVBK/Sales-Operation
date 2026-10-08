from app.services.llm_service import call_llm_json
from app.logging_config import get_logger

logger = get_logger(__name__)

ROUTER_SYSTEM = """
You are a message router for a Sales and Operations AI system.
Classify the user message into EXACTLY one of these four intents:

1. NEW_LEAD       - Someone submitting a new business inquiry or lead
2. DEAL_WON       - Marking a deal or proposal as accepted/won
3. STATUS_QUERY   - Asking about onboarding or deal status
4. TASK_UPDATE    - Requesting a task status change (e.g., move to done, mark in progress)

Return ONLY a JSON object with this exact structure:
{
  "intent": "NEW_LEAD",
  "confidence": 0.95,
  "entity": "Company Name or null"
}

Rules:
- intent must be one of: NEW_LEAD, DEAL_WON, STATUS_QUERY, TASK_UPDATE
- confidence is a float between 0.0 and 1.0
- entity is the company name if mentioned, otherwise null
- Do NOT include any explanation or additional text
"""

VALID_INTENTS = frozenset({"NEW_LEAD", "DEAL_WON", "STATUS_QUERY", "TASK_UPDATE"})
DEFAULT_INTENT = "NEW_LEAD"


def classify_intent(message: str) -> dict:
    """
    Classify a user message into one of the four supported intents.
    Validates LLM output, coerces unknown intents to NEW_LEAD with a warning log.
    Returns dict: {intent, confidence, entity}
    """
    if not message or not isinstance(message, str):
        logger.warning("Empty or invalid message passed to classify_intent; defaulting to NEW_LEAD")
        return {"intent": DEFAULT_INTENT, "confidence": 0.0, "entity": None}

    try:
        result = call_llm_json(ROUTER_SYSTEM, message)
    except Exception as e:
        logger.warning("LLM intent classification failed (%s: %s); defaulting to NEW_LEAD",
                       type(e).__name__, e)
        return {"intent": DEFAULT_INTENT, "confidence": 0.0, "entity": None}

    if not isinstance(result, dict):
        logger.warning("Router LLM returned non-dict; defaulting to NEW_LEAD. Raw: %r", result)
        return {"intent": DEFAULT_INTENT, "confidence": 0.0, "entity": None}

    raw_intent = (result.get("intent") or DEFAULT_INTENT).strip().upper()
    if raw_intent not in VALID_INTENTS:
        logger.warning("Router returned invalid intent=%r; defaulting to NEW_LEAD", raw_intent)
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
