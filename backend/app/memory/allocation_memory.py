from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from motor.motor_asyncio import AsyncIOMotorCollection

from ..database import db


class AllocationMemory:
    def __init__(self) -> None:
        self.collection: AsyncIOMotorCollection = db.get_collection("allocation_memory")

    async def log(self, entry: Dict[str, Any]) -> None:
        document = {
            **entry,
            "timestamp": datetime.utcnow(),
        }
        await self.collection.insert_one(document)

    async def history(self, limit: int = 20) -> List[Dict[str, Any]]:
        cursor = self.collection.find({}).sort("timestamp", -1).limit(limit)
        return [doc async for doc in cursor]


allocation_memory = AllocationMemory()

