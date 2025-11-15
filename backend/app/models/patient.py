from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class Patient(BaseModel):
    id: str = Field(alias="_id")
    name: str
    phone_number: str | None = None
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
    # Additional clinical markers
    albumin: float | None = None
    sodium: float | None = None
    platelet_count: float | None = None
    child_pugh_score: float | None = None
    hepatocellular_carcinoma: bool | None = None
    diabetes: bool | None = None
    renal_failure: bool | None = None
    ventilator_dependent: bool | None = None
    # Immunological
    hla_antibody_level: float | None = None
    # Logistical
    distance_to_donor_km: float | None = None
    icu_bed_available: bool | None = None
    # Contact
    surgeon_phone: str | None = None
    hospital: str | None = None
    profile_verified: bool = False


class PatientList(BaseModel):
    patients: List[Patient]


class PatientProfileUpdate(BaseModel):
    name: str
    phone_number: str | None = None
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
    survival_6hr_prob: float

