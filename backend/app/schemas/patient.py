from __future__ import annotations

from typing import Any, Dict


def patient_document(patient: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "_id": str(patient.get("_id")),
        "name": patient.get("name"),
        "phone_number": patient.get("phone_number"),
        "blood_type": patient.get("blood_type"),
        "hla_match": patient.get("hla_match"),
        "meld": patient.get("meld"),
        "age": patient.get("age"),
        "comorbidities": patient.get("comorbidities"),
        "bilirubin": patient.get("bilirubin"),
        "inr": patient.get("inr"),
        "creatinine": patient.get("creatinine"),
        "ascites_grade": patient.get("ascites_grade"),
        "encephalopathy_grade": patient.get("encephalopathy_grade"),
        "hospitalized_last_7d": patient.get("hospitalized_last_7d"),
        "waitlist_days": patient.get("waitlist_days"),
        "eta_min": patient.get("eta_min"),
        "or_available": patient.get("or_available", False),
        "survival_6hr_prob": patient.get("survival_6hr_prob"),
    }


async def serialize_patients(cursor) -> list[Dict[str, Any]]:
    patients = []
    async for patient in cursor:
        patients.append(patient_document(patient))
    return patients

