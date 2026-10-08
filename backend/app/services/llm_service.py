import json
import re
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    retry_if_result,
)
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.exceptions import OutputParserException
from app.config import GROQ_API_KEY, GROQ_MODEL
from app.logging_config import get_logger

logger = get_logger(__name__)

MAX_RETRIES = 3
INITIAL_WAIT = 0.5  # seconds
MAX_WAIT = 8.0     # seconds


def get_llm(temperature: float = 0.2):
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured. Set GROQ_API_KEY in environment.")
    return ChatGroq(
        model=GROQ_MODEL,
        api_key=GROQ_API_KEY,
        temperature=temperature,
        timeout=60,
        max_retries=0,
    )


def _is_retryable_json_error(value):
    if isinstance(value, Exception):
        if isinstance(value, (json.JSONDecodeError, OutputParserException, ValueError)):
            return True
    return False


def _unwrap_json(content: str) -> str:
    if not content:
        return ""
    stripped = content.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", stripped, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return stripped


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=INITIAL_WAIT, max=MAX_WAIT),
    retry=(
        retry_if_exception_type((ConnectionError, TimeoutError, RuntimeError))
        | retry_if_result(_is_retryable_json_error)
    ),
    reraise=True,
)
def call_llm(system_prompt: str, user_message: str, temperature: float = 0.2) -> str:
    if not system_prompt or not isinstance(system_prompt, str):
        raise ValueError("system_prompt is required and must be a string")
    if user_message is None or not isinstance(user_message, str):
        raise ValueError("user_message is required and must be a string")

    llm = get_llm(temperature)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "{system_prompt}"),
        ("human", "{user_message}"),
    ])
    chain = prompt | llm

    try:
        logger.debug("Invoking LLM system_prompt_len=%d user_len=%d temp=%.2f",
                     len(system_prompt), len(user_message), temperature)
        response = chain.invoke({
            "system_prompt": system_prompt,
            "user_message": user_message,
        })
        content = response.content if hasattr(response, "content") else str(response)
        logger.debug("LLM response received, length=%d", len(content) if content else 0)
        return content
    except Exception as e:
        logger.warning("LLM call failed: %s: %s", type(e).__name__, e)
        raise


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=INITIAL_WAIT, max=MAX_WAIT),
    retry=retry_if_exception_type((ConnectionError, TimeoutError, RuntimeError)),
    reraise=True,
)
def call_llm_json(system_prompt: str, user_message: str, temperature: float = 0.1) -> dict:
    if not system_prompt or not isinstance(system_prompt, str):
        raise ValueError("system_prompt is required and must be a string")
    if user_message is None or not isinstance(user_message, str):
        raise ValueError("user_message is required and must be a string")

    try:
        llm = get_llm(temperature)
        llm = llm.bind(response_format={"type": "json_object"})
        prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt}"),
            ("human", "{user_message}"),
        ])
        chain = prompt | llm

        logger.debug("Invoking LLM (JSON mode) system_prompt_len=%d user_len=%d",
                     len(system_prompt), len(user_message))
        response = chain.invoke({
            "system_prompt": system_prompt,
            "user_message": user_message,
        })
        raw = response.content if hasattr(response, "content") else str(response)
        raw = _unwrap_json(raw)
        return json.loads(raw)
    except json.JSONDecodeError as je:
        logger.warning("JSON mode returned bad JSON, retrying without struct format: %s", je)
        # Fallback chain: normal LLM call + format prompt hint
        fallback_prompt = system_prompt + "\n\nIMPORTANT: Your entire response must be valid JSON only, with no surrounding commentary or markdown."
        raw = call_llm(fallback_prompt, user_message, temperature)
        raw = _unwrap_json(raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError as je2:
            logger.error("Failed to parse LLM JSON after fallback. Raw: %s", raw[:500])
            raise ValueError(
                f"LLM returned invalid JSON even after fallback: {je2}. "
                f"Raw output snippet: {raw[:300]!r}"
            ) from je2
    except Exception as e:
        logger.warning("LLM JSON call failed (%s): %s", type(e).__name__, e)
        raise
