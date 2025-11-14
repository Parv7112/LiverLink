from __future__ import annotations

import motor.motor_asyncio
from pathlib import Path

from loguru import logger
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo.errors import ConfigurationError
from pymongo.uri_parser import parse_uri


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILES = [BASE_DIR / ".env.local", BASE_DIR / ".env"]


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017/liverlink"
    jwt_secret: str = "supersecret"
    jwt_algorithm: str = "HS256"
    jwt_expires_min: int = 60
    bcrypt_rounds: int = 12
    mongo_server_timeout_ms: int = 2000
    mongo_connect_timeout_ms: int = 2000
    mongo_socket_timeout_ms: int = 2000
    twilio_sid: str | None = None
    twilio_token: str | None = None
    twilio_phone: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str = "https://cloud.langfuse.com"
    openai_api_key: str | None = None
    auto_authorize_demo: bool = True
    demo_user_email: str = "demo@liverlink.ai"
    demo_user_name: str = "Demo Surgeon"
    demo_user_password: str = "demo123"

    model_config = SettingsConfigDict(
        env_file=[str(path) for path in ENV_FILES],
        case_sensitive=False,
        env_prefix="",
    )


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
FALLBACK_MONGO_URL = "mongodb://localhost:27017/liverlink"


def _create_client(uri: str) -> motor.motor_asyncio.AsyncIOMotorClient:
    connect_kwargs = {
        "serverSelectionTimeoutMS": settings.mongo_server_timeout_ms,
        "connectTimeoutMS": settings.mongo_connect_timeout_ms,
        "socketTimeoutMS": settings.mongo_socket_timeout_ms,
    }
    try:
        return motor.motor_asyncio.AsyncIOMotorClient(uri, **connect_kwargs)
    except ConfigurationError as exc:
        if uri == FALLBACK_MONGO_URL:
            raise
        logger.warning(
            "MongoDB DNS resolution failed for %s (%s). Falling back to local Mongo at %s.",
            uri,
            exc,
            FALLBACK_MONGO_URL,
        )
        return motor.motor_asyncio.AsyncIOMotorClient(FALLBACK_MONGO_URL, **connect_kwargs)


client = _create_client(settings.mongodb_url)

def _resolve_database_name(uri: str | None) -> str:
    if uri:
        try:
            parsed = parse_uri(uri)
            if parsed.get("database"):
                return parsed["database"]
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Unable to parse Mongo URI %s (%s). Using fallback database name.", uri, exc)
    return "liverlink"


database_name = _resolve_database_name(settings.mongodb_url)
db = client.get_database(database_name)


class MongoBaseModel(BaseModel):
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

