from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorCollection
from pydantic import BaseModel

from ..agents.organ_allocation_agent import OrganAllocationAgent
from ..database import db
from ..models.donor import Donor, DonorCreate
from ..models.user import UserPublic
from ..routers.auth import get_current_user, require_roles
from ..utils.notifications import notification_service, SmsNotification
from ..memory.allocation_memory import allocation_memory

router = APIRouter(prefix="/donors", tags=["donors"])
CoordinatorUser = Annotated[UserPublic, Depends(require_roles("coordinator"))]


async def get_donor_collection() -> AsyncIOMotorCollection:
    return db.get_collection("donors")


def serialize_id(document):
    """Serialize MongoDB document for JSON compatibility."""
    if "_id" in document:
        document["_id"] = str(document["_id"])
    if "created_at" in document and isinstance(document["created_at"], datetime):
        document["created_at"] = document["created_at"].isoformat()
    return document


@router.post("/", response_model=Donor, status_code=status.HTTP_201_CREATED)
async def create_donor(
    _: CoordinatorUser,
    payload: DonorCreate,
    donors: AsyncIOMotorCollection = Depends(get_donor_collection),
) -> Donor:
    existing = await donors.find_one({"qr_code_id": payload.qr_code_id})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Donor already registered")
    document = {
        **payload.model_dump(),
        "created_at": datetime.utcnow(),
    }
    result = await donors.insert_one(document)
    stored = await donors.find_one({"_id": result.inserted_id})
    return Donor(**serialize_id(stored))


@router.get("/{qr_code_id}", response_model=Donor)
async def get_donor(
    _: CoordinatorUser,
    qr_code_id: str,
    donors: AsyncIOMotorCollection = Depends(get_donor_collection),
) -> Donor:
    donor = await donors.find_one({"qr_code_id": qr_code_id})
    if not donor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found")
    return Donor(**serialize_id(donor))


@router.post("/{qr_code_id}/allocate")
async def allocate_donor(
    _: CoordinatorUser,
    qr_code_id: str,
    agent: Annotated[OrganAllocationAgent, Depends(lambda: router.agent)],
    donors: AsyncIOMotorCollection = Depends(get_donor_collection),
) -> dict:
    donor = await donors.find_one({"qr_code_id": qr_code_id})
    if not donor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found")
    await router.manager.notify("allocation_started", {"qr_code_id": qr_code_id})
    asyncio_task = asyncio.create_task(agent.run(serialize_id(donor), surgeon_phone="+15551234567"))
    router.running_tasks.add(asyncio_task)
    return {"status": "started", "qr_code_id": qr_code_id}


class ContactPatientRequest(BaseModel):
    patient_id: str
    donor_qr_code_id: str
    message: str


class AcceptAllocationRequest(BaseModel):
    patient_id: str
    allocation_id: str


@router.post("/{qr_code_id}/contact-patient")
async def contact_patient(
    _: CoordinatorUser,
    qr_code_id: str,
    payload: ContactPatientRequest,
    donors: AsyncIOMotorCollection = Depends(get_donor_collection),
) -> dict:
    """Send SMS to a specific patient's surgeon for manual allocation."""
    # Verify donor exists
    donor = await donors.find_one({"qr_code_id": qr_code_id})
    if not donor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found")
    
    # Get patient details from latest allocation memory
    entries = await allocation_memory.history(limit=10)
    patient_data = None
    allocation_id = None
    
    for entry in entries:
        if entry.get("donor", {}).get("qr_code_id") == qr_code_id:
            allocation_id = str(entry.get("_id"))
            for patient in entry.get("ranked_patients", []):
                if patient.get("patient_id") == payload.patient_id or patient.get("id") == payload.patient_id:
                    patient_data = patient
                    break
            if patient_data:
                break
    
    if not patient_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found in allocation")
    
    # Get surgeon phone
    surgeon_phone = patient_data.get("surgeon_phone", "+15551234567")
    
    # Send SMS
    sms = SmsNotification(
        to=surgeon_phone,
        body=payload.message or f"Organ available for {patient_data.get('name')}. Reply ACCEPT to proceed."
    )
    
    try:
        await notification_service.send_sms(sms)
        return {
            "status": "sent",
            "patient_id": payload.patient_id,
            "surgeon_phone": surgeon_phone,
            "allocation_id": allocation_id,
            "message": "SMS sent successfully" if notification_service.client else "SMS mocked (no Twilio configured)"
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send SMS: {str(exc)}"
        )


@router.post("/{qr_code_id}/accept-allocation")
async def accept_allocation(
    _: CoordinatorUser,
    qr_code_id: str,
    payload: AcceptAllocationRequest,
    donors: AsyncIOMotorCollection = Depends(get_donor_collection),
) -> dict:
    """Manually accept allocation for a specific patient."""
    # Verify donor exists
    donor = await donors.find_one({"qr_code_id": qr_code_id})
    if not donor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found")
    
    # Get allocation from memory
    allocation_collection = db.get_collection("allocation_memory")
    allocation = await allocation_collection.find_one({"_id": ObjectId(payload.allocation_id)})
    
    if not allocation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found")
    
    # Find the patient in ranked_patients
    patient_data = None
    for patient in allocation.get("ranked_patients", []):
        if patient.get("patient_id") == payload.patient_id or patient.get("id") == payload.patient_id:
            patient_data = patient
            break
    
    if not patient_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found in allocation")
    
    # Update allocation with accepted patient
    await allocation_collection.update_one(
        {"_id": ObjectId(payload.allocation_id)},
        {
            "$set": {
                "accepted_patient": patient_data,
                "accepted_at": datetime.utcnow(),
                "accepted_manually": True
            }
        }
    )
    
    # Notify via WebSocket
    await router.manager.notify("allocation_accepted", {
        "qr_code_id": qr_code_id,
        "patient_id": payload.patient_id,
        "patient_name": patient_data.get("name"),
        "allocation_id": payload.allocation_id
    })
    
    return {
        "status": "accepted",
        "patient_id": payload.patient_id,
        "patient_name": patient_data.get("name"),
        "allocation_id": payload.allocation_id,
        "message": f"Organ allocated to {patient_data.get('name')}"
    }


def init_router(agent: OrganAllocationAgent, manager) -> None:
    router.agent = agent
    router.manager = manager
    router.running_tasks = set()

