from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = Field(default="surgeon", pattern="^(surgeon|coordinator|admin)$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    role: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


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

