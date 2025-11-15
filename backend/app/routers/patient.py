from __future__ import annotations

from typing import Any, Dict, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorCollection

from ..database import db
from ..models.patient import Patient, PatientList, PatientProfileUpdate
from ..models.user import UserPublic
from ..routers.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])

DEFAULT_PATIENT_TEMPLATE: Dict[str, Any] = {
    "name": "Carlos Ruiz",
    "phone_number": None,
    "blood_type": "A+",
    "hla_match": 72,
    "meld": 21,
    "age": 63,
    "comorbidities": 4,
    "bilirubin": 10.53,
    "inr": 2.12,
    "creatinine": 1.2,
    "ascites_grade": 0,
    "encephalopathy_grade": 1,
    "hospitalized_last_7d": 1,
    "waitlist_days": 184,
    "eta_min": 86,
    "or_available": True,
    "survival_6hr_prob": 0.34,
    "profile_verified": False,
}


async def get_patient_collection() -> AsyncIOMotorCollection:
    return db.get_collection("patients")


def _resolve_patient_id(patient_id: str) -> Any:
    try:
        return ObjectId(patient_id)
    except Exception:
        return patient_id


def _id_filter(patient_id: str) -> Dict[str, Any]:
    return {"_id": _resolve_patient_id(patient_id)}


async def _ensure_patient_record(
    patients: AsyncIOMotorCollection, patient_id: str, name: str | None = None, phone_number: str | None = None
) -> Dict[str, Any]:
    resolved_id = _resolve_patient_id(patient_id)
    existing = await patients.find_one({"_id": resolved_id})
    if existing:
        return existing

    document = {**DEFAULT_PATIENT_TEMPLATE, "_id": resolved_id}
    if name:
        document["name"] = name
    if phone_number:
        document["phone_number"] = phone_number
    await patients.insert_one(document)
    return document


@router.get("/", response_model=PatientList)
async def list_patients(
    patients: AsyncIOMotorCollection = Depends(get_patient_collection),
    _: UserPublic = Depends(get_current_user),
) -> PatientList:
    cursor = patients.find({}).limit(100)
    items: List[Patient] = []
    async for patient in cursor:
        patient["_id"] = str(patient["_id"])
        items.append(Patient(**patient))
    return PatientList(patients=items)


@router.get("/me/profile", response_model=Patient)
async def get_my_patient_profile(
    patients: AsyncIOMotorCollection = Depends(get_patient_collection),
    current_user: UserPublic = Depends(get_current_user),
) -> Patient:
    if current_user.role != "patient" or not current_user.patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a patient account")
    patient = await _ensure_patient_record(
        patients, current_user.patient_id, current_user.name, getattr(current_user, "phone_number", None)
    )
    patient["_id"] = str(patient["_id"])
    return Patient(**patient)


@router.get("/{patient_id}", response_model=Patient)
async def get_patient(
    patient_id: str,
    patients: AsyncIOMotorCollection = Depends(get_patient_collection),
    _: UserPublic = Depends(get_current_user),
) -> Patient:
    patient = await patients.find_one(_id_filter(patient_id))
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    patient["_id"] = str(patient["_id"])
    return Patient(**patient)


@router.put("/{patient_id}", response_model=Patient)
async def update_patient(
    patient_id: str,
    payload: PatientProfileUpdate,
    patients: AsyncIOMotorCollection = Depends(get_patient_collection),
    current_user: UserPublic = Depends(get_current_user),
) -> Patient:
    patient_filter = _id_filter(patient_id)
    patient = await patients.find_one(patient_filter)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if current_user.role == "patient":
        if not current_user.patient_id or current_user.patient_id != patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit other patient records")

    await patients.update_one(patient_filter, {"$set": {**payload.model_dump(), "profile_verified": True}})
    updated = await patients.find_one(patient_filter)
    updated["_id"] = str(updated["_id"])
    return Patient(**updated)

