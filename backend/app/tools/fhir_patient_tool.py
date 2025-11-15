from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from bson import ObjectId
from langchain.tools import tool
from loguru import logger

from ..database import db

DEFAULT_FEATURES = {
    "meld": 18.0,
    "age": 52.0,
    "comorbidities": 2.0,
    "bilirubin": 1.3,
    "inr": 1.1,
    "creatinine": 1.0,
    "ascites_grade": 1.0,
    "encephalopathy_grade": 1.0,
    "hospitalized_last_7d": 0.0,
    "albumin": 3.5,
    "sodium": 140.0,
    "platelet_count": 150.0,
    "child_pugh_score": 7.0,
    "hepatocellular_carcinoma": 0.0,
    "diabetes": 0.0,
    "renal_failure": 0.0,
    "ventilator_dependent": 0.0,
    "distance_to_donor_km": 200.0,
    "icu_bed_available": 0.0,
}


def _to_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _compute_hla_match(raw: Any) -> int:
    if isinstance(raw, (int, float)):
        return int(raw)
    if isinstance(raw, dict):
        alleles = [raw.get("A"), raw.get("B"), raw.get("DRB1")]
        filled = [allele for allele in alleles if allele]
        if not filled:
            return 60
        seed = "|".join(filled)
        score = 60 + (abs(hash(seed)) % 35)
        return min(95, score)
    if isinstance(raw, str) and raw.strip():
        return 60 + (abs(hash(raw)) % 35)
    return 60


def _derive_comorbidities(death_risk: float) -> float:
    return max(0.0, min(5.0, round(death_risk / 20.0, 1)))


def _derive_lab_value(death_risk: float, baseline: float, scale: float = 80.0) -> float:
    return baseline + death_risk / scale


def _normalize_patient(raw: Dict[str, Any]) -> Dict[str, Any]:
    patient = dict(raw)
    mongo_id = patient.get("_id")
    if isinstance(mongo_id, ObjectId):
        mongo_id = str(mongo_id)
    patient_id = patient.get("patient_id") or patient.get("id") or mongo_id
    if not patient_id:
        patient_id = f"patient-{abs(hash(json.dumps(patient, default=str))) % 10_000}"

    death_risk = _to_float(patient.get("death_risk_6hr"), 20.0)
    meld = _to_float(patient.get("meld_score") or patient.get("meld"), DEFAULT_FEATURES["meld"])
    wait_days = _to_int(patient.get("days_on_waitlist") or patient.get("waitlist_days"), 0)
    eta = _to_int(patient.get("transport_eta_min") or patient.get("eta_min"), 0)
    predicted_1yr = _to_float(
        patient.get("predicted_1yr_survival") or patient.get("predicted_one_year_survival"), 0.0
    )

    features = {
        "meld": meld,
        "age": _to_float(patient.get("age"), DEFAULT_FEATURES["age"]),
        "comorbidities": _to_float(patient.get("comorbidities"), _derive_comorbidities(death_risk)),
        "bilirubin": _to_float(patient.get("bilirubin"), _derive_lab_value(death_risk, 1.2)),
        "inr": _to_float(patient.get("inr"), _derive_lab_value(death_risk, 1.1, 90)),
        "creatinine": _to_float(patient.get("creatinine"), _derive_lab_value(death_risk, 1.0, 110)),
        "ascites_grade": _to_float(patient.get("ascites_grade"), min(3.0, death_risk / 35.0)),
        "encephalopathy_grade": _to_float(patient.get("encephalopathy_grade"), min(4.0, death_risk / 30.0)),
        "hospitalized_last_7d": 0.0 if patient.get("or_available") else 1.0,
        # Additional clinical markers
        "albumin": _to_float(patient.get("albumin"), 4.0 - (death_risk / 50.0)),
        "sodium": _to_float(patient.get("sodium"), 140.0 - (death_risk / 10.0)),
        "platelet_count": _to_float(patient.get("platelet_count"), 200.0 - death_risk),
        "child_pugh_score": _to_float(patient.get("child_pugh_score"), min(15.0, 5.0 + death_risk / 10.0)),
        "hepatocellular_carcinoma": _to_float(patient.get("hepatocellular_carcinoma") or patient.get("hcc"), 0.0),
        "diabetes": _to_float(patient.get("diabetes"), 0.0),
        "renal_failure": _to_float(patient.get("renal_failure"), 0.0),
        "ventilator_dependent": _to_float(patient.get("ventilator_dependent"), 0.0),
        # Logistical factors
        "distance_to_donor_km": _to_float(patient.get("distance_to_donor_km") or patient.get("distance_km"), 200.0),
        "icu_bed_available": _to_float(patient.get("icu_bed_available"), 0.0),
    }

    normalized = {
        "id": str(patient_id),
        "patient_id": patient.get("patient_id") or str(patient_id),
        "name": patient.get("name") or "Unknown Candidate",
        "blood_type": patient.get("blood_type"),
        "age": _to_int(features["age"], 0),
        "meld": int(round(meld)),
        "waitlist_days": wait_days,
        "eta_min": eta,
        "transport_eta_min": eta,
        "or_available": bool(patient.get("or_available")),
        "icu_bed_available": bool(patient.get("icu_bed_available")),
        "hla_type": patient.get("hla_type"),
        "hla_match": _compute_hla_match(patient.get("hla_match") or patient.get("hla_type")),
        "hla_antibody_level": _to_float(patient.get("hla_antibody_level"), 0.0),
        "predicted_1yr_survival": predicted_1yr if predicted_1yr > 0 else None,
        "death_risk_6hr": round(death_risk, 1),
        "survival_hint": max(0.1, min(0.95, 1 - death_risk / 100.0)),
        # Additional clinical fields
        "albumin": features["albumin"],
        "sodium": features["sodium"],
        "platelet_count": features["platelet_count"],
        "child_pugh_score": features["child_pugh_score"],
        "hepatocellular_carcinoma": bool(features["hepatocellular_carcinoma"]),
        "diabetes": bool(features["diabetes"]),
        "renal_failure": bool(features["renal_failure"]),
        "ventilator_dependent": bool(features["ventilator_dependent"]),
        "distance_to_donor_km": features["distance_to_donor_km"],
        # Contact info
        "phone_number": patient.get("phone_number"),
        "surgeon_phone": patient.get("surgeon_phone"),
        "hospital": patient.get("hospital"),
    }
    normalized.update(features)
    return normalized


def _load_from_csv() -> List[Dict[str, Any]]:
    mock_path = Path(__file__).resolve().parents[2] / "mock_data" / "patients_survival.csv"
    if not mock_path.exists():
        return []
    import pandas as pd

    df = pd.read_csv(mock_path)
    logger.info("Loaded %d patients from mock CSV", len(df))
    return df.to_dict(orient="records")


@tool("fetch_fhir_patients", return_direct=False)
async def fetch_fhir_patients(query: str = "") -> str:  # noqa: ARG001
    """Fetch the current liver waitlist from MongoDB."""
    patients_collection = db.get_collection("patients")
    raw_patients: List[Dict[str, Any]] = []
    
    try:
        cursor = patients_collection.find({})
        async for patient in cursor:
            raw_patients.append(patient)
        logger.info(f"Fetched {len(raw_patients)} patients from MongoDB")
    except Exception as exc:
        logger.error(f"Failed to fetch patients from MongoDB: {exc}")
        return "[]"

    if not raw_patients:
        logger.warning("No patients found in MongoDB collection 'patients'")
        return "[]"

    try:
        normalized = [_normalize_patient(patient) for patient in raw_patients]
        logger.info(f"Normalized {len(normalized)} patients for allocation")
        logger.debug(f"Sample patient: {normalized[0] if normalized else 'none'}")
        return json.dumps(normalized, default=str)
    except Exception as exc:
        logger.error(f"Failed to normalize patients: {exc}")
        return "[]"

