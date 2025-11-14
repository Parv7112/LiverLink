from __future__ import annotations

import json
from typing import Any, Dict

from langchain.tools import tool
from loguru import logger

from ..utils.notifications import SmsNotification, notification_service


@tool("send_surgeon_alert", return_direct=False)
async def send_surgeon_alert(data: str) -> str:
    """Send SMS alert to a surgeon. Data must contain phone and message."""
    try:
        payload: Dict[str, Any] = json.loads(data)
    except json.JSONDecodeError as exc:  # pragma: no cover - validated upstream
        raise ValueError("Invalid JSON for SMS alert") from exc

    phone = payload.get("phone")
    message = payload.get("message")
    if not phone or not message:
        raise ValueError("Missing phone or message in alert payload")
    await notification_service.send_sms(SmsNotification(to=phone, body=message))
    logger.info("Alert sent to %s", phone)
    return json.dumps({"status": "sent", "phone": phone})

