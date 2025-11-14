from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo.errors import PyMongoError

from ..database import db
from ..models.user import Token, UserCreate, UserLogin, UserPublic
from ..utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
memory_users: dict[str, dict[str, str]] = {}


async def get_user_collection() -> AsyncIOMotorCollection:
    return db.get_collection("users")


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate, users: AsyncIOMotorCollection = Depends(get_user_collection)) -> UserPublic:
    try:
        existing = await users.find_one({"email": payload.email})
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        hashed = hash_password(payload.password)
        doc = {
            "email": payload.email,
            "name": payload.name,
            "password": hashed,
            "role": payload.role,
            "created_at": datetime.utcnow(),
        }
        result = await users.insert_one(doc)
        stored = await users.find_one({"_id": result.inserted_id})
    except PyMongoError as exc:  # pragma: no cover - requires external service
        logger.warning("MongoDB unavailable during registration; falling back to memory store: {}", exc)
        stored = _register_memory_user(payload)
    stored["_id"] = str(stored["_id"])
    return UserPublic(**stored)


@router.post("/login", response_model=Token)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends(), users: AsyncIOMotorCollection = Depends(get_user_collection)) -> Token:
    db_user = None
    try:
        db_user = await users.find_one({"email": form_data.username})
    except PyMongoError as exc:  # pragma: no cover
        logger.warning("MongoDB unavailable during login; checking memory store: {}", exc)
    user = db_user or memory_users.get(form_data.username)
    if not user or not verify_password(form_data.password, user.get("password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    user_id = user.get("_id") or memory_users.get(form_data.username, {}).get("_id")
    token = create_access_token(str(user_id))
    return Token(access_token=token)


async def get_current_user(token: str = Depends(oauth2_scheme), users: AsyncIOMotorCollection = Depends(get_user_collection)) -> UserPublic:
    from ..utils.security import decode_token

    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    try:
        object_id = ObjectId(user_id)
    except Exception as exc:  # pragma: no cover - data validation
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc
    user = await users.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user["_id"] = str(user["_id"])
    return UserPublic(**user)


def _register_memory_user(payload: UserCreate) -> dict:
    if payload.email in memory_users:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed = hash_password(payload.password)
    doc = {
        "_id": str(uuid4()),
        "email": payload.email,
        "name": payload.name,
        "password": hashed,
        "role": payload.role,
        "created_at": datetime.utcnow(),
    }
    memory_users[payload.email] = doc
    return doc

