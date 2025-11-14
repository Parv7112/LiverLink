from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, TypedDict

from langchain.tools import Tool
from langgraph.graph import StateGraph
from langgraph.graph.graph import END
from langfuse import Langfuse
from loguru import logger

from ..ai.survival_model import MODEL_FEATURES, predict_survival
from ..database import settings
from ..memory.allocation_memory import allocation_memory
from ..tools.fhir_patient_tool import fetch_fhir_patients
from ..tools.or_status_tool import check_or_status
from ..tools.sms_alert_tool import send_surgeon_alert


@dataclass
class AgentEvent:
    type: str
    payload: Dict[str, Any]


class AllocationState(TypedDict):
    donor: Dict[str, Any]
    patients: List[Dict[str, Any]]
    ranked_patients: List[Dict[str, Any]]
    reasoning: List[str]
    alerts: List[Dict[str, Any]]
    iteration: int
    accepted_patient: Optional[Dict[str, Any]]
    timeline: List[Dict[str, Any]]


class OrganAllocationAgent:
    def __init__(self, event_sink) -> None:
        self.event_sink = event_sink
        self.langfuse = None
        if settings.langfuse_public_key and settings.langfuse_secret_key:
            self.langfuse = Langfuse(
                public_key=settings.langfuse_public_key,
                secret_key=settings.langfuse_secret_key,
                host=settings.langfuse_host,
            )
        self.tools: Dict[str, Tool] = {
            "fetch": fetch_fhir_patients,
            "alert": send_surgeon_alert,
            "or_status": check_or_status,
        }
        self.graph = self._build_graph()

    def _build_graph(self):
        graph = StateGraph(AllocationState)
        graph.add_node("fetch_patients", self._fetch_patients)
        graph.add_node("predict", self._predict_survival)
        graph.add_node("rank", self._rank_patients)
        graph.add_node("alert", self._alert_surgeon)
        graph.add_node("evaluate", self._evaluate_outcome)

        graph.add_edge("fetch_patients", "predict")
        graph.add_edge("predict", "rank")
        graph.add_edge("rank", "alert")
        graph.add_conditional_edges("alert", self._alert_condition, {"retry": "rank", "success": "evaluate"})
        graph.add_edge("evaluate", END)

        graph.set_entry_point("fetch_patients")
        return graph.compile()

    async def run(self, donor: Dict[str, Any], surgeon_phone: str) -> AllocationState:
        initial_state: AllocationState = {
            "donor": donor,
            "patients": [],
            "ranked_patients": [],
            "reasoning": [
                f"Initiated allocation for donor {donor.get('qr_code_id', 'unknown')} {donor.get('organ', '').upper()}"
            ],
            "alerts": [],
            "iteration": 0,
            "accepted_patient": None,
            "timeline": [],
        }
        trace = None
        if self.langfuse:
            trace = self.langfuse.trace(
                name="liverlink_allocation",
                input=donor,
                metadata={"organ": donor.get("organ"), "qr_code": donor.get("qr_code_id")},
            )
        state = initial_state
        async for step, current_state in self.graph.astream(state):
            state = current_state
            message = {
                "step": step,
                "state": self._serialize_state(current_state),
            }
            await self.event_sink(AgentEvent(type="agent_step", payload=message))
            if trace:
                trace.span(
                    name=f"step_{step}",
                    input=message,
                    output=current_state,
                )
        if trace:
            trace.update(output=state, status="completed")
        await allocation_memory.log(
            {
                "donor": donor,
                "ranked_patients": state.get("ranked_patients", [])[:5],
                "accepted_patient": state.get("accepted_patient"),
                "timeline": state.get("timeline"),
            }
        )
        return state

    async def _fetch_patients(self, state: AllocationState) -> AllocationState:
        result_json = await self.tools["fetch"].arun("")
        patients = json.loads(result_json)
        reasoning = state["reasoning"] + [f"Fetched {len(patients)} patients from FHIR service."]
        timeline = state["timeline"] + [
            {"event": "fetch_patients", "timestamp": datetime.utcnow().isoformat()},
        ]
        await self.event_sink(
            AgentEvent(
                "agent_reasoning",
                {"message": f"Evaluating {len(patients)} patients for compatibility."},
            )
        )
        return {
            **state,
            "patients": patients,
            "reasoning": reasoning,
            "timeline": timeline,
        }

    async def _predict_survival(self, state: AllocationState) -> AllocationState:
        patients = state["patients"]
        features = [[patient.get(feature, 0) for feature in MODEL_FEATURES] for patient in patients]
        if features:
            predictions = await predict_survival(features)
        else:
            predictions = []
        for patient, prob in zip(patients, predictions):
            patient["survival_6hr_prob"] = prob
        reasoning = state["reasoning"] + ["Calculated 6-hour survival probabilities for candidates."]
        timeline = state["timeline"] + [
            {"event": "predict_survival", "timestamp": datetime.utcnow().isoformat()},
        ]
        await self.event_sink(
            AgentEvent(
                "agent_reasoning",
                {"message": "Survival predictions complete. Preparing ranking."},
            )
        )
        return {
            **state,
            "patients": patients,
            "reasoning": reasoning,
            "timeline": timeline,
        }

    async def _rank_patients(self, state: AllocationState) -> AllocationState:
        donor = state["donor"]
        ranked = []
        for patient in state["patients"]:
            urgency = patient.get("meld", 0) / 40
            survival = patient.get("survival_6hr_prob", 0.0)
            hla = patient.get("hla_match", 0) / 100
            score = 0.5 * urgency + 0.35 * survival + 0.15 * hla
            ranked.append({**patient, "allocation_score": score})
        ranked.sort(key=lambda item: item.get("allocation_score", 0), reverse=True)
        highlight = (
            f"Top candidate {ranked[0]['name']} with survival {ranked[0]['survival_6hr_prob']:.0%}"
            if ranked
            else "No candidates available"
        )
        reasoning = state["reasoning"] + [
            f"Ranked {len(ranked)} patients. {highlight}.",
        ]
        timeline = state["timeline"] + [
            {"event": "rank_patients", "timestamp": datetime.utcnow().isoformat()},
        ]
        await self.event_sink(
            AgentEvent(
                "agent_reasoning",
                {"message": highlight},
            )
        )
        return {
            **state,
            "ranked_patients": ranked,
            "reasoning": reasoning,
            "timeline": timeline,
        }

    async def _alert_surgeon(self, state: AllocationState) -> AllocationState:
        iteration = state["iteration"] + 1
        ranked = state["ranked_patients"]
        if not ranked:
            await self.event_sink(
                AgentEvent("agent_reasoning", {"message": "No ranked patients available. Escalating."})
            )
            return {**state, "iteration": iteration}

        patient = ranked[0]
        message = (
            f"Surgeon alert: {patient['name']} survival {patient['survival_6hr_prob']:.0%}, MELD {patient['meld']}"
        )
        payload = json.dumps({"phone": patient.get("surgeon_phone", "+15551234567"), "message": message})
        await self.tools["alert"].arun(payload)
        reasoning = state["reasoning"] + [f"Alerted surgeon for {patient['name']} (attempt {iteration})."]
        timeline = state["timeline"] + [
            {"event": "alert_surgeon", "timestamp": datetime.utcnow().isoformat(), "patient": patient["id"]},
        ]
        alerts = state["alerts"] + [
            {
                "patient": patient,
                "message": message,
                "attempt": iteration,
                "status": "pending",
            }
        ]
        # Simulate waiting for surgeon response
        await asyncio.sleep(0.1)
        accepted = iteration >= 2 or patient.get("survival_6hr_prob", 0) >= 0.7
        if accepted:
            alerts[-1]["status"] = "accepted"
            accepted_patient = patient
            reasoning.append(f"Surgeon accepted {patient['name']}. Locking organ.")
            await self.event_sink(
                AgentEvent(
                    "agent_reasoning",
                    {"message": f"Surgeon accepted {patient['name']}. Organ reserved."},
                )
            )
        else:
            accepted_patient = None
            reasoning.append(
                f"No response from surgeon for {patient['name']}. Will re-plan in next iteration."
            )
            await self.event_sink(
                AgentEvent(
                    "agent_reasoning",
                    {"message": "No acknowledgement. Re-planning..."},
                )
            )
            ranked = ranked[1:] + ranked[:1]

        await self.event_sink(
            AgentEvent(
                "agent_alert",
                {
                    "patient": patient,
                    "attempt": iteration,
                    "message": message,
                    "status": alerts[-1]["status"],
                },
            )
        )

        return {
            **state,
            "iteration": iteration,
            "alerts": alerts,
            "reasoning": reasoning,
            "accepted_patient": accepted_patient,
            "timeline": timeline,
            "ranked_patients": ranked,
        }

    def _alert_condition(self, state: AllocationState) -> str:
        if state.get("accepted_patient"):
            return "success"
        if state.get("iteration", 0) >= 3 or not state.get("ranked_patients"):
            return "success"
        return "retry"

    async def _evaluate_outcome(self, state: AllocationState) -> AllocationState:
        accepted = state.get("accepted_patient")
        if accepted:
            await self.tools["or_status"].arun(json.dumps({"patient_id": accepted["id"]}))
            message = f"Allocation locked for {accepted['name']}."
        else:
            message = "No allocation completed. Escalate to coordinator."
        reasoning = state["reasoning"] + [message]
        timeline = state["timeline"] + [
            {"event": "evaluation", "timestamp": datetime.utcnow().isoformat(), "message": message},
        ]
        await self.event_sink(AgentEvent("agent_reasoning", {"message": message}))
        return {
            **state,
            "reasoning": reasoning,
            "timeline": timeline,
        }

    def _serialize_state(self, state: AllocationState) -> Dict[str, Any]:
        def _clean_patient(patient: Dict[str, Any]) -> Dict[str, Any]:
            return {
                key: value
                for key, value in patient.items()
                if key
                in {
                    "id",
                    "name",
                    "survival_6hr_prob",
                    "allocation_score",
                    "meld",
                    "waitlist_days",
                    "eta_min",
                    "hla_match",
                }
            }

        return {
            "donor": state.get("donor"),
            "top_candidates": [_clean_patient(p) for p in state.get("ranked_patients", [])[:5]],
            "iteration": state.get("iteration"),
            "accepted_patient": _clean_patient(state["accepted_patient"]) if state.get("accepted_patient") else None,
            "reasoning": state.get("reasoning"),
            "alerts": state.get("alerts"),
        }


async def default_event_sink(event: AgentEvent) -> None:
    logger.debug("Agent event: %s", event)


agent = OrganAllocationAgent(default_event_sink)

