from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from typing import Optional

from loguru import logger
from twilio.rest import Client

from ..database import settings


@dataclass
class SmsNotification:
    to: str
    body: str


def normalize_phone_number(phone: str) -> str:
    """
    Normalize phone number to E.164 format for Twilio.
    Removes dashes, spaces, parentheses, and ensures proper formatting.
    
    Examples:
        "+1-555-0199" -> "+15550199"
        "+1 (555) 123-4567" -> "+15551234567"
        "555-1234" -> "+1555-1234" (passthrough if already starts with +)
    """
    if not phone:
        return phone
    
    # Remove all non-digit characters except the leading +
    if phone.startswith('+'):
        # Keep the + and remove all other non-digits
        normalized = '+' + re.sub(r'\D', '', phone[1:])
    else:
        # Remove all non-digits
        normalized = re.sub(r'\D', '', phone)
        # Add + prefix if not present
        if not normalized.startswith('+'):
            normalized = '+' + normalized
    
    logger.debug(f"Normalized phone number: {phone} -> {normalized}")
    return normalized


class NotificationService:
    def __init__(self) -> None:
        if not settings.twilio_sid or not settings.twilio_token:
            logger.warning("Twilio credentials missing; SMS notifications will be mocked.")
            self.client: Optional[Client] = None
        else:
            self.client = Client(settings.twilio_sid, settings.twilio_token)
        self.sender_phone = settings.twilio_phone or "+1234567890"

    async def send_sms(self, message: SmsNotification) -> None:
        # Normalize phone number to E.164 format
        normalized_phone = normalize_phone_number(message.to)
        
        if self.client is None:
            logger.info("Mock SMS: %s -> %s", normalized_phone, message.body)
            return
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: self.client.messages.create(
                    to=normalized_phone,
                    from_=self.sender_phone,
                    body=message.body,
                ),
            )
            logger.info("SMS sent to %s (normalized from %s)", normalized_phone, message.to)
        except Exception as exc:
            logger.warning("SMS delivery failed for %s (normalized: %s): %s. Continuing allocation.", 
                         message.to, normalized_phone, exc)


notification_service = NotificationService()

