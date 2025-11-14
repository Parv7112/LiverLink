from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorCollection

from ..agents.organ_allocation_agent import OrganAllocationAgent
from ..database import db
from ..models.donor import Donor, DonorCreate
from ..routers.auth import get_current_user

router = APIRouter(prefix="/donors", tags=["donors"])


async def get_donor_collection() -> AsyncIOMotorCollection:
    return db.get_collection("donors")


def serialize_id(document):
    document["_id"] = str(document["_id"])
    return document


@router.post("/", response_model=Donor, status_code=status.HTTP_201_CREATED)
async def create_donor(
    payload: DonorCreate,
    donors: AsyncIOMotorCollection = Depends(get_donor_collection),
    _: dict = Depends(get_current_user),
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
async def get_donor(qr_code_id: str, donors: AsyncIOMotorCollection = Depends(get_donor_collection), _: dict = Depends(get_current_user)) -> Donor:
    donor = await donors.find_one({"qr_code_id": qr_code_id})
    if not donor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found")
    return Donor(**serialize_id(donor))


@router.post("/{qr_code_id}/allocate")
async def allocate_donor(
    qr_code_id: str,
    agent: Annotated[OrganAllocationAgent, Depends(lambda: router.agent)],
    donors: AsyncIOMotorCollection = Depends(get_donor_collection),
    _: dict = Depends(get_current_user),
) -> dict:
    donor = await donors.find_one({"qr_code_id": qr_code_id})
    if not donor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found")
    await router.manager.notify("allocation_started", {"qr_code_id": qr_code_id})
    asyncio_task = asyncio.create_task(agent.run(serialize_id(donor), surgeon_phone="+15551234567"))
    router.running_tasks.add(asyncio_task)
    return {"status": "started", "qr_code_id": qr_code_id}


def init_router(agent: OrganAllocationAgent, manager) -> None:
    router.agent = agent
    router.manager = manager
    router.running_tasks = set()

