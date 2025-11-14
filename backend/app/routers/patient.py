from __future__ import annotations

from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorCollection

from ..database import db
from ..models.patient import Patient, PatientList
from ..routers.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])


async def get_patient_collection() -> AsyncIOMotorCollection:
    return db.get_collection("patients")


@router.get("/", response_model=PatientList)
async def list_patients(patients: AsyncIOMotorCollection = Depends(get_patient_collection), _: dict = Depends(get_current_user)) -> PatientList:
    cursor = patients.find({}).limit(100)
    items: List[Patient] = []
    async for patient in cursor:
        patient["_id"] = str(patient["_id"])
        items.append(Patient(**patient))
    return PatientList(patients=items)


@router.get("/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str, patients: AsyncIOMotorCollection = Depends(get_patient_collection), _: dict = Depends(get_current_user)) -> Patient:
    try:
        object_id = ObjectId(patient_id)
    except Exception as exc:  # pragma: no cover - validated upstream
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid patient id") from exc
    patient = await patients.find_one({"_id": object_id})
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    patient["_id"] = str(patient["_id"])
    return Patient(**patient)

