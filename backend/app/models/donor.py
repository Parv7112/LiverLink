from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Donor(BaseModel):
    id: str = Field(alias="_id")
    qr_code_id: str
    organ: str
    blood_type: str
    age: int
    cause_of_death: str
    crossmatch_score: int
    procurement_hospital: str
    arrival_eta_min: int
    created_at: datetime | None = None


class DonorCreate(BaseModel):
    qr_code_id: str
    organ: str
    blood_type: str
    age: int
    cause_of_death: str
    crossmatch_score: int
    procurement_hospital: str
    arrival_eta_min: int


class DonorUpdate(BaseModel):
    crossmatch_score: int | None = None
    arrival_eta_min: int | None = None

