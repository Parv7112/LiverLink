from __future__ import annotations

import motor.motor_asyncio
from pydantic import BaseModel
from pydantic_settings import BaseSettings


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

    class Config:
        env_file = "backend/.env"
        env_prefix = ""
        case_sensitive = False


def get_settings() -> Settings:
    return Settings()


settings = get_settings()

client = motor.motor_asyncio.AsyncIOMotorClient(
    settings.mongodb_url,
    serverSelectionTimeoutMS=settings.mongo_server_timeout_ms,
    connectTimeoutMS=settings.mongo_connect_timeout_ms,
    socketTimeoutMS=settings.mongo_socket_timeout_ms,
)
db = client.get_default_database() if settings.mongodb_url else client.liverlink


class MongoBaseModel(BaseModel):
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

