from app.services.llm_service import call_llm_json
from app.logging_config import get_logger

logger = get_logger(__name__)

SCORING_SYSTEM_PROMPT = """
You are an expert sales AI designed to evaluate leads.
Analyze the provided lead data and calculate a realistic, nuanced score (0-100) based on their budget, business need, timeline, decision maker status, and company fit.

Respond ONLY with a JSON object matching this structure:
{
  "score": <float>,
  "tier": "<HIGH|MEDIUM|LOW>",
  "components": {
    "budget": <float 0-25>,
    "business_need": <float 0-25>,
    "timeline": <float 0-20>,
    "decision_maker": <float 0-15>,
    "company_fit": <float 0-15>
  },
  "reasons": [
    "<reason 1>",
    "<reason 2>"
  ]
}

Guidelines:
- Score >= 80 is HIGH, 50-79 is MEDIUM, < 50 is LOW.
- Be highly analytical and realistic. Take into account implied urgency, size of budget, and specific business challenges.
- Justify your score in the reasons array.
- Components MUST add up (within rounding) to the overall score (sum components == score).
"""

BUDGET_THRESHOLDS = [
    (5000000, 25.0),
    (2000000, 22.0),
    (1000000, 19.0),
    (500000, 15.0),
    (200000, 10.0),
    (50000, 5.0),
    (0, 2.0),
]
TIMELINE_SCORES = {
    "immediately": 20.0,
    "urgent": 20.0,
    "1 week": 19.0,
    "15 days": 18.0,
    "2 weeks": 17.0,
    "30 days": 16.0,
    "one month": 16.0,
    "1 month": 16.0,
    "45 days": 14.0,
    "2 months": 12.0,
    "3 months": 10.0,
    "6 months": 7.0,
    "90 days": 9.0,
    "quarter": 8.0,
    "year": 4.0,
}


def _parse_budget_value(raw) -> float:
    try:
        if raw is None:
            return 0.0
        return float(raw)
    except (TypeError, ValueError):
        s = str(raw).lower()
        for token, mult in [("lakh", 100000), ("lac", 100000), ("crore", 10000000),
                            ("k", 1000), ("m", 1000000), ("b", 1000000000)]:
            if token in s:
                try:
                    num = float("".join(ch for ch in s if ch.isdigit() or ch == "."))
                    return num * mult
                except ValueError:
                    continue
        try:
            digits = "".join(ch for ch in s if ch.isdigit() or ch == ".")
            return float(digits) if digits else 0.0
        except ValueError:
            return 0.0


def _heuristic_budget_score(budget_raw) -> float:
    budget = _parse_budget_value(budget_raw)
    for threshold, score in BUDGET_THRESHOLDS:
        if budget >= threshold:
            return score
    return 0.0


def _heuristic_need_score(business_need: str | None) -> float:
    if not business_need:
        return 5.0
    s = business_need.lower()
    strong = [
        "critical", "urgent", "production", "compliance", "license",
        "audit", "legal", "security breach", "broken", "outage",
        "mandatory", "regulatory", "required by", "not working",
    ]
    medium = [
        "need", "require", "want", "looking for", "improve", "upgrade",
        "replace", "expand", "scale", "streamline", "reduce cost",
        "inventory", "management", "crm", "erp", "system",
    ]
    if any(kw in s for kw in strong):
        return 23.0
    if any(kw in s for kw in medium):
        return 17.0
    if len(s) >= 20:
        return 12.0
    return 8.0


def _heuristic_timeline_score(timeline: str | None) -> float:
    if not timeline:
        return 4.0
    s = str(timeline).lower().strip()
    for key, score in TIMELINE_SCORES.items():
        if key in s:
            return score
    # Number of days detection
    for days, score in [(15, 18.0), (30, 16.0), (60, 13.0), (90, 9.0), (180, 6.0)]:
        if f"{days}" in s or f" {days//30}" in s or str(days//7) + " week" in s:
            return score
    if any(ch.isdigit() for ch in s):
        return 10.0
    return 5.0


def _heuristic_decision_maker_score(decision_maker) -> float:
    if decision_maker is True:
        return 14.0
    if decision_maker is False:
        return 4.0
    return 8.0


def _heuristic_company_fit_score(lead_data: dict) -> float:
    company = (lead_data.get("company_name") or "").strip()
    contact = (lead_data.get("contact_name") or "").strip()
    email = (lead_data.get("email") or "").strip()
    score = 4.0
    if company and len(company) >= 3:
        score += 3.0
    if contact:
        score += 3.0
    if email and ("@" in email):
        score += 3.0
    return min(score, 15.0)


def _tier_from_score(score: float) -> str:
    if score >= 80.0:
        return "HIGH"
    if score >= 50.0:
        return "MEDIUM"
    return "LOW"


def _fallback_heuristic_score(lead_data: dict) -> dict:
    """
    Robust deterministic fallback scoring based on weighted heuristics.
    Components sum to overall score, tier is derived from the threshold.
    """
    budget = _heuristic_budget_score(lead_data.get("budget"))
    need = _heuristic_need_score(lead_data.get("business_need") or lead_data.get("need"))
    timeline = _heuristic_timeline_score(lead_data.get("timeline"))
    dm = _heuristic_decision_maker_score(lead_data.get("decision_maker"))
    fit = _heuristic_company_fit_score(lead_data)
    score = round(budget + need + timeline + dm + fit, 2)
    tier = _tier_from_score(score)

    reasons = []
    if budget >= 19:
        reasons.append(f"Budget score is high ({budget}/25) indicating strong financial commitment.")
    elif budget <= 10:
        reasons.append(f"Budget score is modest ({budget}/25); follow-up may be required.")
    if need >= 17:
        reasons.append("Business need signals urgency or high-impact use case.")
    if timeline >= 14:
        reasons.append("Timeline indicates near-term implementation intent.")
    if lead_data.get("decision_maker") is True:
        reasons.append("Contact appears to be a decision maker.")
    else:
        reasons.append("Decision maker status is unclear; consider validating during outreach.")

    logger.info(
        "Applied heuristic fallback score company=%s score=%.2f tier=%s (LLM call unavailable or failed)",
        lead_data.get("company_name"), score, tier,
    )

    return {
        "score": score,
        "tier": tier,
        "components": {
            "budget": round(budget, 2),
            "business_need": round(need, 2),
            "timeline": round(timeline, 2),
            "decision_maker": round(dm, 2),
            "company_fit": round(fit, 2),
        },
        "reasons": reasons or ["Heuristic fallback score applied."],
    }


def _normalize_score_result(result: dict) -> dict:
    try:
        score = float(result.get("score", 0))
        score = max(0.0, min(100.0, score))
        tier = (result.get("tier") or _tier_from_score(score)).upper()
        if tier not in {"HIGH", "MEDIUM", "LOW"}:
            tier = _tier_from_score(score)
        components = result.get("components") or {}
        def _clamp(v, lo, hi):
            try:
                return max(lo, min(hi, float(v)))
            except (TypeError, ValueError):
                return lo
        normalized_components = {
            "budget": _clamp(components.get("budget", 10), 0, 25),
            "business_need": _clamp(components.get("business_need", 10), 0, 25),
            "timeline": _clamp(components.get("timeline", 10), 0, 20),
            "decision_maker": _clamp(components.get("decision_maker", 10), 0, 15),
            "company_fit": _clamp(components.get("company_fit", 10), 0, 15),
        }
        reasons = result.get("reasons")
        if not isinstance(reasons, list) or not reasons:
            reasons = ["Score calculated from lead data."]
        return {
            "score": round(score, 2),
            "tier": tier,
            "components": {k: round(v, 2) for k, v in normalized_components.items()},
            "reasons": reasons,
        }
    except Exception as e:
        logger.warning("Could not normalize LLM score result, falling back to heuristic: %s", e)
        return _fallback_heuristic_score({})


def score_lead(lead_data: dict) -> dict:
    """
    Intelligent LLM-based lead scoring function.
    Validates LLM output and degrades to a weighted heuristic on failure.
    """
    if not isinstance(lead_data, dict):
        logger.warning("Invalid lead_data passed to score_lead (not dict), using heuristic.")
        return _fallback_heuristic_score({})

    user_message = f"Lead Data:\n{json_safe_dump(lead_data)}"

    try:
        result = call_llm_json(SCORING_SYSTEM_PROMPT, user_message, temperature=0.3)
        if not isinstance(result, dict) or "score" not in result or "tier" not in result:
            logger.warning("LLM score response missing score/tier, using heuristic fallback.")
            return _fallback_heuristic_score(lead_data)
        normalized = _normalize_score_result(result)
        logger.info(
            "Lead scored via LLM company=%s score=%.2f tier=%s",
            lead_data.get("company_name"), normalized["score"], normalized["tier"],
        )
        return normalized
    except Exception as e:
        logger.warning("LLM scoring failed (%s: %s); applying heuristic fallback.",
                       type(e).__name__, e)
        return _fallback_heuristic_score(lead_data)


def json_safe_dump(obj) -> str:
    import json
    try:
        return json.dumps(obj, default=str, ensure_ascii=False, indent=2)
    except Exception:
        return str(obj)
