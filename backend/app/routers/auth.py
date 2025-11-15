from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, Form, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo.errors import PyMongoError

from ..database import db, settings
from ..models.user import AuthResponse, UserCreate, UserPublic, UserRole
from ..utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


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
            "phone_number": payload.phone_number,
            "patient_id": str(ObjectId()) if payload.role == "patient" else None,
            "created_at": datetime.utcnow(),
        }
        result = await users.insert_one(doc)
        stored = await users.find_one({"_id": result.inserted_id})
    except PyMongoError as exc:  # pragma: no cover - requires external service
        from ..utils.logging import log_db_error

        log_db_error("register_user", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration failed. Try again when database is available.",
        ) from exc
    stored["_id"] = str(stored["_id"])
    return UserPublic(**stored)


class LoginForm:
    def __init__(
        self,
        username: str = Form(...),
        password: str = Form(...),
        role: str = Form(...),
    ) -> None:
        self.username = username
        self.password = password
        self.role = role


@router.post("/login", response_model=AuthResponse)
async def login_user(form_data: LoginForm = Depends(), users: AsyncIOMotorCollection = Depends(get_user_collection)) -> AuthResponse:
    try:
        user = await users.find_one({"email": form_data.username})
    except PyMongoError as exc:  # pragma: no cover
        from ..utils.logging import log_db_error

        log_db_error("login_user", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login unavailable. Try again shortly.",
        ) from exc
    if not user or not verify_password(form_data.password, user.get("password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if user.get("role") != form_data.role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Role mismatch for this account")
    user_id = str(user["_id"])
    user["_id"] = user_id
    token = create_access_token(user_id)
    public_user = UserPublic(**user)
    return AuthResponse(access_token=token, user=public_user, message="Welcome back")


async def _ensure_demo_user(users: AsyncIOMotorCollection) -> UserPublic:
    demo = await users.find_one({"email": settings.demo_user_email})
    if not demo:
        hashed = hash_password(settings.demo_user_password)
        doc = {
            "email": settings.demo_user_email,
            "name": settings.demo_user_name,
            "password": hashed,
            "role": "surgeon",
            "created_at": datetime.utcnow(),
        }
        result = await users.insert_one(doc)
        demo = await users.find_one({"_id": result.inserted_id})
    else:
        update_fields = {}
        if "name" not in demo:
            update_fields["name"] = settings.demo_user_name
        if "created_at" not in demo:
            update_fields["created_at"] = datetime.utcnow()
        if update_fields:
            await users.update_one({"_id": demo["_id"]}, {"$set": update_fields})
            demo.update(update_fields)
    demo["_id"] = str(demo["_id"])
    return UserPublic(**demo)


async def get_current_user(
    token: str | None = Security(oauth2_scheme),
    users: AsyncIOMotorCollection = Depends(get_user_collection),
) -> UserPublic:
    from ..utils.security import decode_token

    if not token:
        if settings.auto_authorize_demo:
            return await _ensure_demo_user(users)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")

    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
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


def require_roles(*roles: UserRole):
    def dependency(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if roles and user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this action",
            )
        return user

    return dependency

