from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorCollection
from pydantic import BaseModel

from ..agents.organ_allocation_agent import OrganAllocationAgent
from ..database import db
from ..models.donor import Donor, DonorCreate
from ..models.user import UserPublic
from ..routers.auth import get_current_user, require_roles
from ..utils.notifications import notification_service, SmsNotification, normalize_phone_number
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
    phone_number: str | None = None  # Optional: manual override (database values take priority)


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
    
    # Get phone number priority:
    # 1. Patient's phone_number (direct patient contact - PRIMARY)
    # 2. Patient's surgeon_phone (surgeon contact - fallback)
    # 3. Payload phone_number override (manual override)
    # 4. Default fallback
    phone_source = "default"
    if patient_data.get("phone_number"):
        phone_number = patient_data.get("phone_number")
        phone_source = "phone_number (database)"
    elif patient_data.get("surgeon_phone"):
        phone_number = patient_data.get("surgeon_phone")
        phone_source = "surgeon_phone (database)"
    elif payload.phone_number:
        phone_number = payload.phone_number
        phone_source = "payload (manual override)"
    else:
        phone_number = "+15551234567"
        phone_source = "default fallback"
    
    # Normalize phone number to E.164 format for Twilio
    normalized_phone = normalize_phone_number(phone_number)
    
    logger.info(f"Contact patient {payload.patient_id}: using {phone_source} -> {phone_number} (normalized: {normalized_phone})")
    
    # Send SMS
    sms = SmsNotification(
        to=phone_number,  # Will be normalized in send_sms
        body=payload.message or f"Organ available for {patient_data.get('name')}. Reply ACCEPT to proceed."
    )
    
    try:
        await notification_service.send_sms(sms)
        
        # Check if SMS was actually sent or mocked
        if notification_service.client:
            status_msg = "SMS sent successfully via Twilio"
        else:
            status_msg = "SMS mocked (no Twilio configured)"
        
        return {
            "status": "sent",
            "patient_id": payload.patient_id,
            "phone_number": phone_number,
            "phone_number_normalized": normalized_phone,
            "phone_source": phone_source,
            "allocation_id": allocation_id,
            "message": status_msg,
            "twilio_configured": notification_service.client is not None
        }
    except Exception as exc:
        # SMS failed but we don't want to block the allocation
        logger.error(f"SMS send failed for {phone_number} (normalized: {normalized_phone}): {exc}")
        return {
            "status": "failed",
            "patient_id": payload.patient_id,
            "phone_number": phone_number,
            "phone_number_normalized": normalized_phone,
            "phone_source": phone_source,
            "allocation_id": allocation_id,
            "message": f"SMS delivery failed: {str(exc)}",
            "twilio_configured": notification_service.client is not None,
            "error": str(exc)
        }


@router.get("/{qr_code_id}/debug-allocation")
async def debug_allocation(
    _: CoordinatorUser,
    qr_code_id: str,
) -> dict:
    """Debug endpoint to check what patient data is stored in allocation memory."""
    entries = await allocation_memory.history(limit=10)
    
    for entry in entries:
        if entry.get("donor", {}).get("qr_code_id") == qr_code_id:
            ranked_patients = entry.get("ranked_patients", [])
            return {
                "found": True,
                "donor_qr": qr_code_id,
                "ranked_patients_count": len(ranked_patients),
                "sample_patient": ranked_patients[0] if ranked_patients else None,
                "patient_fields": list(ranked_patients[0].keys()) if ranked_patients else []
            }
    
    return {"found": False, "donor_qr": qr_code_id}


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

