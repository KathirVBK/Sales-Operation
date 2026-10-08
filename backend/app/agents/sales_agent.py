"""
Sales Agent: extracts lead information, validates, scores, generates outreach.
"""
import json
from app.services.llm_service import call_llm_json, call_llm
from app.tools.scoring_tools import score_lead
from app.tools.lead_tools import save_lead
from app.logging_config import get_logger

logger = get_logger(__name__)

REQUIRED_FIELDS = ["company_name", "budget", "business_need", "timeline"]

EXTRACTION_SYSTEM = """
You are a Sales AI assistant. Extract structured lead information from the user's message.

Return ONLY a JSON object with these fields (use null for unknown values):
{
  "company_name": "string or null",
  "contact_name": "string or null",
  "email": "string or null",
  "inquiry": "string - full inquiry text",
  "budget": number or null (convert currency to numeric, e.g. ₹8 lakh = 800000),
  "business_need": "string or null - what they need",
  "timeline": "string or null - when they want to implement",
  "decision_maker": true or false
}

Rules:
- budget must be a number (not a string). Convert "₹8 lakh" to 800000, "₹5 lakh" to 500000, etc.
- decision_maker: true if the contact is an owner/founder/director/manager or says they make decisions
- Do NOT invent or guess any information not present in the message
- inquiry should be the verbatim user inquiry
"""

OUTREACH_SYSTEM = """
You are a professional sales copywriter.
Write a personalized sales outreach email based on the lead information provided.
Return ONLY a JSON object:
{
  "subject": "email subject line",
  "body": "email body text"
}

Guidelines:
- HOT tier: personalized, enthusiastic, specific to their need, with a clear call to action
- WARM tier: nurturing message, show value, invite a conversation
- COLD tier: brief, low-pressure, just keeping in touch
- Keep body under 200 words
- Address the contact by name if available
- Sign off from "The Sales Team"
"""

FIELD_LABELS = {
    "company_name": "company name",
    "budget": "approximate budget",
    "business_need": "specific business requirement",
    "timeline": "implementation timeline",
    "contact_name": "contact person's name",
    "email": "email address",
    "decision_maker": "whether you are the decision maker",
}


def _normalize_lead_extraction(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    budget = raw.get("budget")
    if isinstance(budget, str):
        try:
            s = budget.lower().replace(",", "")
            for token, mult in [("lakh", 100000), ("lac", 100000), ("crore", 10000000),
                                ("k", 1000), ("m", 1000000)]:
                if token in s:
                    num_str = "".join(ch for ch in s if ch.isdigit() or ch == ".")
                    if num_str:
                        budget = float(num_str) * mult
                        break
            else:
                num_str = "".join(ch for ch in s if ch.isdigit() or ch == ".")
                budget = float(num_str) if num_str else None
        except (ValueError, TypeError):
            budget = None
    dm = raw.get("decision_maker")
    if isinstance(dm, str):
        dm_lower = dm.strip().lower()
        dm = dm_lower in {"true", "yes", "y", "1"}
    business_need = (
        raw.get("business_need")
        or raw.get("need")
        or raw.get("requirements")
    )
    if isinstance(business_need, str):
        business_need = business_need.strip() or None
    company = raw.get("company_name")
    if isinstance(company, str):
        company = company.strip() or None
    timeline = raw.get("timeline")
    if isinstance(timeline, str):
        timeline = timeline.strip() or None
    contact_name = raw.get("contact_name")
    if isinstance(contact_name, str):
        contact_name = contact_name.strip() or None
    email = raw.get("email")
    if isinstance(email, str):
        email = email.strip() or None
    inquiry = raw.get("inquiry") or ""
    if not isinstance(inquiry, str):
        inquiry = str(inquiry)
    return {
        "company_name": company,
        "contact_name": contact_name,
        "email": email,
        "inquiry": inquiry,
        "budget": budget,
        "business_need": business_need,
        "timeline": timeline,
        "decision_maker": bool(dm) if isinstance(dm, bool) else None,
    }


def _extract_lead(message: str) -> dict:
    raw = call_llm_json(EXTRACTION_SYSTEM, message)
    return _normalize_lead_extraction(raw)


def _check_missing(lead: dict) -> list[str]:
    missing = []
    for field in REQUIRED_FIELDS:
        val = lead.get(field)
        if val is None or (isinstance(val, str) and val.strip() == ""):
            missing.append(field)
    return missing


def _normalize_outreach(raw: dict, tier: str) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    subject = (raw.get("subject") or "").strip()
    body = (raw.get("body") or "").strip()
    if not subject:
        subject_map = {
            "HOT": "Let's talk about your project",
            "WARM": "Following up on your inquiry",
            "COLD": "Quick note following your inquiry",
        }
        subject = subject_map.get(tier, "Following up on your inquiry")
    if not body:
        body = (
            "Hello, thank you for reaching out. We'd love to learn more about your "
            "requirements and explore how we can help. Please reply to this email "
            "to schedule a short call at your convenience.\n\nBest regards,\nThe Sales Team"
        )
    return {"subject": subject, "body": body}


def _generate_outreach(lead: dict, tier: str) -> dict:
    prompt = (
        f"Lead Information:\n"
        f"- Company: {lead.get('company_name', 'Unknown')}\n"
        f"- Contact: {lead.get('contact_name', 'there')}\n"
        f"- Need: {lead.get('business_need') or lead.get('need', '')}\n"
        f"- Budget: {lead.get('budget', 'Not specified')}\n"
        f"- Timeline: {lead.get('timeline', 'Not specified')}\n"
        f"- Tier: {tier}\n"
    )
    try:
        raw = call_llm_json(OUTREACH_SYSTEM, prompt)
        return _normalize_outreach(raw, tier)
    except Exception as e:
        logger.warning("Outreach generation failed (%s: %s); using template fallback.",
                       type(e).__name__, e)
        return _normalize_outreach({}, tier)


def _ask_clarification(missing_fields: list[str]) -> str:
    questions = [f"{i+1}. What is your {FIELD_LABELS.get(f, f)}?"
                 for i, f in enumerate(missing_fields)]
    return "To qualify this lead, I need a few more details:\n" + "\n".join(questions)


def run_sales_agent(message: str, existing_lead: dict = None) -> dict:
    """
    Main Sales Agent function.

    Returns:
        {
            status: QUALIFIED | NEEDS_CLARIFICATION | ERROR,
            message: str,
            lead_id: int | None,
            lead: dict | None,
            score_result: dict | None,
            outreach: dict | None,
            missing_fields: list | None,
        }
    """
    try:
        if not message or not isinstance(message, str):
            return {
                "status": "ERROR",
                "message": "Please provide a message to process.",
                "lead_id": None, "lead": None,
                "score_result": None, "outreach": None, "missing_fields": None,
            }

        extracted = _extract_lead(message)

        if existing_lead:
            lead_data = dict(existing_lead)
            for key, value in extracted.items():
                if value is not None and (
                    lead_data.get(key) is None
                    or (isinstance(lead_data.get(key), str) and lead_data.get(key).strip() == "")
                ):
                    lead_data[key] = value
        else:
            lead_data = extracted

        missing = _check_missing(lead_data)

        if missing:
            logger.info("Sales agent: NEEDS_CLARIFICATION missing=%s for company=%s",
                        missing, lead_data.get("company_name"))
            clarification = _ask_clarification(missing)
            return {
                "status": "NEEDS_CLARIFICATION",
                "message": clarification,
                "lead": lead_data,
                "missing_fields": missing,
                "lead_id": None,
                "score_result": None,
                "outreach": None,
            }

        score_result = score_lead(lead_data)

        outreach = _generate_outreach(lead_data, score_result["tier"])

        lead_id = save_lead(lead_data, score_result, outreach)

        tier = score_result["tier"]
        tier_messages = {
            "HOT": "🔥 This is a HOT lead! Outreach draft generated.",
            "WARM": "✅ Qualified as a WARM lead. Follow-up draft ready.",
            "COLD": "❄️ Lead is COLD. A gentle follow-up has been prepared.",
        }
        response_msg = (
            "Lead qualified successfully.\n\n"
            f"**Company:** {lead_data.get('company_name', 'Unknown')}\n"
            f"**Score:** {score_result['score']}/100\n"
            f"**Tier:** {tier}\n\n"
            f"{tier_messages.get(tier, 'Lead processed.')}"
        )

        logger.info("Sales agent: QUALIFIED lead_id=%s company=%s tier=%s score=%.2f",
                    lead_id, lead_data.get("company_name"), tier, score_result["score"])

        return {
            "status": "QUALIFIED",
            "message": response_msg,
            "lead_id": lead_id,
            "lead": lead_data,
            "score_result": score_result,
            "outreach": outreach,
            "missing_fields": [],
        }

    except Exception as e:
        logger.exception("Sales Agent error")
        return {
            "status": "ERROR",
            "message": f"Sales Agent encountered an error: {type(e).__name__}",
            "lead_id": None,
            "lead": None,
            "score_result": None,
            "outreach": None,
            "missing_fields": None,
        }
