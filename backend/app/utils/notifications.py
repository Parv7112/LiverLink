from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Optional

from loguru import logger
from twilio.rest import Client

from ..database import settings


@dataclass
class SmsNotification:
    to: str
    body: str


class NotificationService:
    def __init__(self) -> None:
        if not settings.twilio_sid or not settings.twilio_token:
            logger.warning("Twilio credentials missing; SMS notifications will be mocked.")
            self.client: Optional[Client] = None
        else:
            self.client = Client(settings.twilio_sid, settings.twilio_token)
        self.sender_phone = settings.twilio_phone or "+1234567890"

    async def send_sms(self, message: SmsNotification) -> None:
        if self.client is None:
            logger.info("Mock SMS: %s -> %s", message.to, message.body)
            return
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: self.client.messages.create(
                    to=message.to,
                    from_=self.sender_phone,
                    body=message.body,
                ),
            )
            logger.info("SMS sent to %s", message.to)
        except Exception as exc:
            logger.warning("SMS delivery failed for %s: %s. Continuing allocation.", message.to, exc)


notification_service = NotificationService()

