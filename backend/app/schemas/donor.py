from __future__ import annotations

from typing import Any, Dict


def donor_document(donor: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "_id": str(donor.get("_id")),
        "qr_code_id": donor.get("qr_code_id"),
        "organ": donor.get("organ"),
        "blood_type": donor.get("blood_type"),
        "age": donor.get("age"),
        "cause_of_death": donor.get("cause_of_death"),
        "crossmatch_score": donor.get("crossmatch_score"),
        "procurement_hospital": donor.get("procurement_hospital"),
        "arrival_eta_min": donor.get("arrival_eta_min"),
        "hla_a": donor.get("hla_a"),
        "hla_b": donor.get("hla_b"),
        "hla_drb1": donor.get("hla_drb1"),
        "donor_meld_context": donor.get("donor_meld_context"),
    }

