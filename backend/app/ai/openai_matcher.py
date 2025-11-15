"""OpenRouter-powered intelligent organ matching and survival prediction."""

from __future__ import annotations

import json
from typing import Any, Dict, List

from loguru import logger
from openai import AsyncOpenAI

from ..database import settings


class OpenAIMatcher:
    """Uses OpenRouter (multi-model AI gateway) to intelligently match donors with patients and predict outcomes."""

    def __init__(self):
        if not settings.openai_api_key:
            logger.warning("OpenRouter API key not configured. Using fallback heuristic matching.")
            self.client = None
        else:
            # OpenRouter uses OpenAI-compatible API with custom base_url
            self.client = AsyncOpenAI(
                api_key=settings.openai_api_key,
                base_url="https://openrouter.ai/api/v1"
            )
            logger.info("OpenRouter matcher initialized successfully")

    async def predict_survival_batch(
        self, donor: Dict[str, Any], patients: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Use OpenAI to predict survival probability and compatibility for each patient.
        
        Returns enriched patient list with:
        - survival_6hr_prob: AI-predicted survival (0-1)
        - ai_reasoning: Natural language explanation
        - compatibility_score: Overall match quality (0-1)
        """
        if not self.client:
            # Fallback to heuristic
            return self._fallback_predictions(patients)

        try:
            # Prepare patient summaries for AI
            patient_summaries = []
            for i, patient in enumerate(patients[:10]):  # Limit to top 10 for token efficiency
                patient_summaries.append({
                    "index": i,
                    "name": patient.get("name"),
                    "age": patient.get("age"),
                    "meld": patient.get("meld"),
                    "blood_type": patient.get("blood_type"),
                    "hla_type": patient.get("hla_type"),
                    "comorbidities": patient.get("comorbidities"),
                    "bilirubin": patient.get("bilirubin"),
                    "inr": patient.get("inr"),
                    "creatinine": patient.get("creatinine"),
                    "albumin": patient.get("albumin"),
                    "sodium": patient.get("sodium"),
                    "child_pugh_score": patient.get("child_pugh_score"),
                    "diabetes": patient.get("diabetes"),
                    "renal_failure": patient.get("renal_failure"),
                    "hepatocellular_carcinoma": patient.get("hepatocellular_carcinoma"),
                    "ventilator_dependent": patient.get("ventilator_dependent"),
                    "distance_km": patient.get("distance_to_donor_km"),
                    "icu_available": patient.get("icu_bed_available"),
                    "or_available": patient.get("or_available"),
                    "waitlist_days": patient.get("waitlist_days"),
                })

            donor_summary = {
                "organ": donor.get("organ"),
                "blood_type": donor.get("blood_type"),
                "age": donor.get("age"),
                "hla_a": donor.get("hla_a"),
                "hla_b": donor.get("hla_b"),
                "hla_drb1": donor.get("hla_drb1"),
                "cause_of_death": donor.get("cause_of_death"),
                "crossmatch_score": donor.get("crossmatch_score"),
            }

            prompt = f"""You are an expert transplant surgeon AI with deep knowledge of post-transplant outcomes, complications, and long-term prognosis.

DONOR:
{json.dumps(donor_summary, indent=2)}

PATIENTS (top candidates):
{json.dumps(patient_summaries, indent=2)}

For EACH patient, analyze the transplant outcome comprehensively:

1. **survival_6hr_prob**: Immediate post-operative survival (0.0 to 1.0)
   - Consider: MELD score, age, comorbidities, lab values, organ quality
   - Higher MELD = more urgent but potentially lower survival
   - Comorbidities (diabetes, renal failure, HCC, ventilator) reduce survival
   - Better labs (albumin, sodium, lower bilirubin/INR/creatinine) improve survival

2. **compatibility_score**: Overall donor-patient match quality (0.0 to 1.0)
   - Blood type compatibility, HLA matching, age matching
   - Distance and hospital readiness (ICU/OR availability)
   - Organ quality vs patient condition

3. **reasoning**: Comprehensive 4-5 sentence analysis including:
   - **Immediate risks**: What could go wrong in first 24-48 hours? (bleeding, primary graft dysfunction, infection)
   - **Short-term outlook (30 days)**: Expected recovery trajectory, complications risk
   - **Long-term prognosis (1-5 years)**: Graft survival probability, rejection risk, quality of life
   - **Key risk factors**: Specific concerns for THIS patient (age, comorbidities, HCC recurrence, renal failure progression)
   - **Success indicators**: What makes this a good/poor match?

Example reasoning format:
"IMMEDIATE: Moderate surgical risk due to MELD 28 and coagulopathy (INR 1.8). Risk of bleeding and primary graft dysfunction ~15%. 
SHORT-TERM: If survives surgery, 30-day survival 85% with good HLA match reducing rejection risk. May need dialysis support initially due to renal dysfunction.
LONG-TERM: 5-year graft survival estimated 70%. HCC history increases recurrence risk to 20% within 3 years. Diabetes requires careful immunosuppression management.
RECOMMENDATION: Acceptable candidate if ICU support available. Benefits outweigh risks given high MELD urgency."

Respond with ONLY valid JSON array (no markdown, no extra text):
[
  {{
    "index": 0,
    "survival_6hr_prob": 0.75,
    "compatibility_score": 0.82,
    "reasoning": "IMMEDIATE: Low surgical risk with MELD 22, stable labs. Bleeding risk <5%. SHORT-TERM: 30-day survival 90%, excellent HLA match. LONG-TERM: 5-year graft survival 80%, no HCC. Good candidate."
  }},
  ...
]

Be realistic and evidence-based. Survival probabilities: 0.3-0.95. Consider both urgency and outcomes."""

            response = await self.client.chat.completions.create(
                model="openai/gpt-4o-mini",  # Very reliable and cheap ($0.15/1M tokens) via OpenRouter
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert transplant surgeon AI with deep knowledge of post-transplant outcomes, complications, and long-term prognosis. Provide detailed, evidence-based predictions in JSON format only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,  # Low temperature for consistent medical predictions
                max_tokens=4000,  # Increased for detailed analysis
            )

            # Parse AI response
            ai_response = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if ai_response.startswith("```"):
                ai_response = ai_response.split("```")[1]
                if ai_response.startswith("json"):
                    ai_response = ai_response[4:]
                ai_response = ai_response.strip()
            
            predictions = json.loads(ai_response)

            # Merge predictions back into patient data
            for pred in predictions:
                idx = pred["index"]
                if idx < len(patients):
                    patients[idx]["survival_6hr_prob"] = pred["survival_6hr_prob"]
                    patients[idx]["ai_compatibility_score"] = pred["compatibility_score"]
                    patients[idx]["ai_reasoning"] = pred["reasoning"]

            # For patients not analyzed (beyond top 10), use fallback
            for i in range(len(predictions), len(patients)):
                patients[i] = self._fallback_single_prediction(patients[i])

            logger.info(f"OpenAI predicted survival for {len(predictions)} patients")
            return patients

        except Exception as exc:
            logger.error(f"OpenAI prediction failed: {exc}. Using fallback.")
            return self._fallback_predictions(patients)

    async def rank_patients_with_ai(
        self, donor: Dict[str, Any], patients: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Use OpenAI to intelligently rank patients considering all factors holistically.
        
        Returns patients sorted by AI-determined allocation priority.
        """
        if not self.client or len(patients) == 0:
            return patients

        try:
            # First get survival predictions
            patients = await self.predict_survival_batch(donor, patients)

            # Use AI compatibility score as primary ranking factor
            # Combined with survival and urgency
            for patient in patients:
                urgency = patient.get("meld", 0) / 40
                survival = patient.get("survival_6hr_prob", 0.5)
                ai_compat = patient.get("ai_compatibility_score", 0.5)
                
                # AI-driven allocation score
                # Give more weight to AI compatibility which considers all factors
                allocation_score = (
                    0.40 * ai_compat +      # AI holistic compatibility
                    0.35 * urgency +        # Medical urgency
                    0.25 * survival         # Survival probability
                )
                
                patient["allocation_score"] = allocation_score
                patient["urgency_score"] = urgency
                patient["survival_score"] = survival
                patient["ai_compatibility_score"] = ai_compat

            # Sort by allocation score
            patients.sort(key=lambda p: p.get("allocation_score", 0), reverse=True)
            
            logger.info(f"AI ranked {len(patients)} patients. Top: {patients[0].get('name')} (score: {patients[0].get('allocation_score', 0):.3f})")
            return patients

        except Exception as exc:
            logger.error(f"AI ranking failed: {exc}")
            return patients

    def _fallback_predictions(self, patients: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fallback heuristic predictions when OpenAI unavailable."""
        for patient in patients:
            patient = self._fallback_single_prediction(patient)
        return patients

    def _fallback_single_prediction(self, patient: Dict[str, Any]) -> Dict[str, Any]:
        """Simple heuristic prediction for a single patient."""
        meld = patient.get("meld", 18)
        age = patient.get("age", 50)
        comorbidities = patient.get("comorbidities", 0)
        
        # Simple heuristic
        survival = 0.85 - (meld / 100) - (age / 200) - (comorbidities * 0.05)
        survival = max(0.1, min(0.95, survival))
        
        patient["survival_6hr_prob"] = survival
        patient["ai_compatibility_score"] = 0.5
        patient["ai_reasoning"] = "Fallback heuristic prediction (OpenAI unavailable)"
        
        return patient


# Global instance
openai_matcher = OpenAIMatcher()

