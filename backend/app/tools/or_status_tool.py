from __future__ import annotations

import json
from random import randint
from typing import Any, Dict

from langchain.tools import tool
from loguru import logger


@tool("check_or_status", return_direct=False)
async def check_or_status(data: str) -> str:
    """Check OR availability status and estimated prep time."""
    try:
        payload: Dict[str, Any] = json.loads(data) if data else {}
    except json.JSONDecodeError as exc:  # pragma: no cover - validated upstream
        raise ValueError("Invalid JSON for OR status tool") from exc

    requested_or = payload.get("or", "OR-1")
    status = {
        "or": requested_or,
        "available": True,
        "preparation_min": randint(5, 20),
        "notes": "OR prepped for transplant",
    }
    logger.info("OR status for %s -> %s", requested_or, status)
    return json.dumps(status)

