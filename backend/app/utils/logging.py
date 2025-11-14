from __future__ import annotations

from loguru import logger


def log_db_error(context: str, exc: Exception) -> None:
    logger.error("Database error in {}: {}", context, exc)

