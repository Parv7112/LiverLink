from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


UserRole = Literal["coordinator", "surgeon", "admin"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str
    role: UserRole = Field(default="surgeon")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    role: UserRole
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(Token):
    user: UserPublic
    message: str = "Authenticated"


class TokenPayload(BaseModel):
    sub: str
    exp: int


class AgentAlert(BaseModel):
    surgeon_id: str
    patient_id: str
    donor_id: str
    status: str
    message: str
    created_at: datetime
    acknowledged_at: Optional[datetime] = None

