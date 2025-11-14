import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "./socket";

export type AgentEvent = {
  event: string;
  payload: any;
};

export type CandidateSummary = {
  id?: string;
  name?: string;
  meld?: number;
  waitlist_days?: number;
  eta_min?: number;
  transport_eta_min?: number;
  survival_6hr_prob?: number;
  allocation_score?: number;
  hla_match?: number;
  blood_type?: string;
  age?: number;
  predicted_1yr_survival?: number;
  death_risk_6hr?: number;
  or_available?: boolean;
  survival_hint?: number;
};

export type AgentStatus = {
  step: string;
  iteration: number;
  reasoning: string[];
  lastMessage: string;
  topCandidates: CandidateSummary[];
  acceptedPatient?: CandidateSummary | null;
  alerts: Array<{
    patient?: CandidateSummary;
    message: string;
    attempt: number;
    status: string;
  }>;
};

const defaultStatus: AgentStatus = {
  step: "idle",
  iteration: 0,
  reasoning: ["Awaiting donor scan"],
  lastMessage: "Idle",
  topCandidates: [],
  acceptedPatient: null,
  alerts: [],
};

function normaliseCandidate(candidate: any): CandidateSummary {
  if (!candidate) return {};
  return {
    id: candidate.id ?? candidate._id,
    name: candidate.name,
    meld: candidate.meld,
    waitlist_days: candidate.waitlist_days,
    eta_min: candidate.eta_min,
    transport_eta_min: candidate.transport_eta_min ?? candidate.eta_min,
    survival_6hr_prob: candidate.survival_6hr_prob,
    allocation_score: candidate.allocation_score,
    hla_match: candidate.hla_match,
    blood_type: candidate.blood_type,
    age: candidate.age,
    predicted_1yr_survival: candidate.predicted_1yr_survival,
    death_risk_6hr: candidate.death_risk_6hr,
    or_available: candidate.or_available,
    survival_hint: candidate.survival_hint,
  };
}

export function useAgentFeed() {
  const [status, setStatus] = useState<AgentStatus>(defaultStatus);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const liveSocket = getSocket();
    setSocket(liveSocket);
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/agent`;
    const ws = new WebSocket(wsUrl);

    const handleEvent = (data: AgentEvent) => {
      setEvents((prev) => [...prev.slice(-50), data]);
      if (data.event === "agent_step") {
        const { step, state } = data.payload;
        setStatus((prev) => ({
          ...prev,
          step,
          iteration: state.iteration ?? prev.iteration,
          topCandidates: (state.top_candidates ?? state.topCandidates ?? []).map(normaliseCandidate),
          acceptedPatient: normaliseCandidate(state.accepted_patient ?? state.acceptedPatient),
          reasoning: state.reasoning ?? prev.reasoning,
          lastMessage: `Step: ${step}`,
        }));
      } else if (data.event === "agent_reasoning") {
        setStatus((prev) => ({
          ...prev,
          reasoning: [...prev.reasoning.slice(-6), data.payload.message],
          lastMessage: data.payload.message,
        }));
      } else if (data.event === "agent_alert") {
        setStatus((prev) => ({
          ...prev,
          alerts: [...prev.alerts.slice(-5), {
            patient: normaliseCandidate(data.payload.patient),
            attempt: data.payload.attempt,
            message: data.payload.message,
            status: data.payload.status ?? "pending",
          }],
          lastMessage: data.payload.message,
        }));
      } else if (data.event === "allocation_triggered") {
        setStatus({
          ...defaultStatus,
          step: "fetch_patients",
          reasoning: ["Donor scanned. Fetching waitlist."],
          lastMessage: "Fetching waitlist",
        });
      }
    };

    const listener = (event: string, payload: any) => {
      handleEvent({ event, payload });
    };

    liveSocket.onAny(listener);

    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        handleEvent(data);
      } catch (error) {
        console.warn("Unable to parse websocket message", error);
      }
    };

    return () => {
      liveSocket.offAny(listener);
      ws.close();
    };
  }, []);

  const progress = useMemo(() => {
    const steps = ["fetch_patients", "predict", "rank", "alert", "evaluate"];
    return steps.map((step) => ({
      step,
      complete: steps.indexOf(step) < steps.indexOf(status.step),
      active: step === status.step,
    }));
  }, [status.step]);

  return { status, events, progress, socket };
}
