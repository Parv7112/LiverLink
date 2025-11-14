from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from langchain.tools import tool
from loguru import logger

from ..database import db


@tool("fetch_fhir_patients", return_direct=False)
async def fetch_fhir_patients(query: str = "") -> str:  # noqa: ARG001
    """Fetch the current liver waitlist from MongoDB or fallback mock file."""
    patients_collection = db.get_collection("patients")
    patients: List[Dict[str, Any]] = []
    async for patient in patients_collection.find({}).limit(100):
        patients.append(patient)

    if not patients:
        mock_path = Path(__file__).resolve().parents[2] / "mock_data" / "patients_survival.csv"
        if mock_path.exists():
            import pandas as pd

            df = pd.read_csv(mock_path)
            patients = df.to_dict(orient="records")
            logger.info("Loaded %d patients from mock CSV", len(patients))
        else:
            logger.warning("No patient data found; returning empty list")
    return json.dumps(patients)

