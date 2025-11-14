from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class Patient(BaseModel):
    id: str = Field(alias="_id")
    name: str
    blood_type: str
    hla_match: int
    meld: int
    age: int
    comorbidities: int
    bilirubin: float
    inr: float
    creatinine: float
    ascites_grade: int
    encephalopathy_grade: int
    hospitalized_last_7d: int
    waitlist_days: int
    eta_min: int
    or_available: bool
    survival_6hr_prob: float | None = None
    created_at: datetime | None = None


class PatientList(BaseModel):
    patients: List[Patient]

