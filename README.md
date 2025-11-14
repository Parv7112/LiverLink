# LiverLink

> **Tagline:** *"From death to hope in 57 minutes"*

LiverLink is a production-ready liver allocation platform that fuses a LangGraph-powered autonomous agent, 6-hour survival prediction, and real-time clinical collaboration. It scans donor QR codes, ranks patients in seconds, alerts surgeons through SMS + sockets, explains every decision, and retries until an organ is secured.

---

## ✨ Highlights
- **Agentic AI:** LangGraph workflow (plan → act → re-plan) with tool usage, memory, and narrative reasoning.
- **Survival Intelligence:** RandomForest-based 6-hour survival prediction (MELD + labs).
- **Realtime Ops:** FastAPI WebSocket + Socket.IO feed, animated React 18 dashboard, QR scanning, confetti moments.
- **Observability:** Langfuse tracing hooks for full run analytics & evaluation.
- **Production Ready:** Dockerized services, MongoDB Atlas-ready, JWT auth, typed schemas (Pydantic + Zod).

---

## 🏗 Project Structure
```
LiverLink/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI + Socket.IO entrypoint
│   │   ├── agents/organ_allocation_agent.py
│   │   ├── ai/survival_model.py    # Runtime inference helper
│   │   ├── ai/train_survival.py    # Training script (RandomForestRegressor)
│   │   ├── routers/{auth,donor,patient}.py
│   │   ├── tools/{fhir_patient_tool,sms_alert_tool,or_status_tool}.py
│   │   ├── memory/allocation_memory.py
│   │   ├── models/, schemas/, utils/
│   │   └── ai/survival_6hr_model.pkl
│   ├── requirements.txt
│   ├── Dockerfile
│   └── langfuse_trace_example.json
├── frontend/
│   ├── src/components/{AIAgentStatus,SurvivalCard,QRScanner,AlertCard}.tsx
│   ├── src/pages/{SurgeonDashboard,DonorScan,AgentLog}.tsx
│   ├── src/lib/{api,socket,agent}.ts
│   ├── App.tsx · main.tsx · index.css
│   ├── package.json · Dockerfile · tailwind.config.js
│   └── index.html
├── mock_data/patients_survival.csv
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quickstart

### 1. Environment
```bash
cp backend/.env backend/.env.local  # edit secrets: MongoDB, Twilio, Langfuse, JWT
```
Key variables:
- `MONGODB_URL` (Atlas or local)
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`
- `TWILIO_*` for SMS alerts
- `OPENAI_API_KEY` (optional, dealer’s choice)

### 2. Local Development
#### Backend
> **Tip:** Use Python 3.11 for the backend virtualenv so scikit-learn wheels install without compiling.

```bash
cd backend
/usr/local/bin/python3.11 -m venv .venv && source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 8000
```
#### Frontend
```bash
cd frontend
npm install
npm run dev
```
Navigate to [http://localhost:5173](http://localhost:5173) (Vite dev server).

### 3. Docker (Prod-ready)
```bash
docker-compose up --build
```
Services:
- `mongo`: MongoDB 6.0 (port 27017)
- `backend`: FastAPI + LangGraph (port 8000)
- `frontend`: Static React (port 5173 → 4173 inside container)

### 4. Authenticate Before Using Donor Scan
Create a coordinator account via the API (or Swagger UI) the first time:
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@liverlink.ai","password":"demo123","name":"Demo Surgeon","role":"surgeon"}'
```
Then log in (either through the UI login card on the Donor Scan page or via curl) to obtain a JWT. The scanning form stays locked until a valid token is stored, ensuring every donor intake is admin-led.

Prefer a UI flow? Click **Admin Login** in the header → “Create an account” to open the built-in registration form. After a successful signup you’re redirected back to the login panel with a confirmation banner; once logged in you’ll see session banners for future organ submissions as well.

---

## 🧠 Agent Architecture
- **Graph:** `fetch_patients → predict → rank → alert → evaluate` with retry loops (`langgraph.StateGraph`).
- **Tools:**
  - `fetch_fhir_patients` → MongoDB/CSV fallback
  - `send_surgeon_alert` → Twilio SMS with mock fallback
  - `check_or_status` → OR prep ETA estimator
- **Memory:** Mongo-backed `allocation_memory` for explainability + agent log UI.
- **Reasoning Feed:** union of LangGraph state + natural language strings pushed over WebSocket + Socket.IO.

---

## 📈 Survival Model
- **Features:** `meld, age, comorbidities, bilirubin, inr, creatinine, ascites_grade, encephalopathy_grade, hospitalized_last_7d`
- **Target:** `survival_6hr` (0–1 probability)
- **Algorithm:** `RandomForestRegressor` (scikit-learn).

### Retrain in minutes
```bash
cd backend
pip install -r requirements.txt
python -m app.ai.train_survival --data ../mock_data/patients_survival.csv
```
Outputs `app/ai/survival_6hr_model.pkl` (overwrites heuristic bootstrap model). Metrics print to stdout.

---

## 🔭 Langfuse Observability
- Backend boots a `Langfuse` client when keys are present.
- Each allocation run emits a trace `liverlink_allocation` with per-step spans (`step_fetch_patients`, etc.).
- Sample payload: `backend/langfuse_trace_example.json`.

### Enable Langfuse UI
1. Export `LANGFUSE_*` env vars.
2. Run backend.
3. Open [Langfuse dashboard](https://cloud.langfuse.com/) → filter on project `liverlink_allocation`.

---

## 🔐 API Surface (JWT protected)
- `POST /auth/register` → create surgeon/coordinator.
- `POST /auth/login` → OAuth2 password, returns JWT.
- `GET /patients/` → list waitlist with latest model scores.
- `POST /donors/` → register scanned donor.
- `POST /donors/{qr}/allocate` → kick off agent run (emits realtime events + SMS).
- `POST /agent/allocate` → generic trigger (manual payload).
- `GET /agent/history` → retrieve LangGraph memory ledger.
- `WebSocket /ws/agent` + `Socket.IO` → realtime event bus.

Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

### Role-based access controls
- **Coordinator** — full donor intake + allocation powers (`/donors`, `/agent/allocate`).
- **Surgeon/Admin** — read-only dashboards (`/patients`, `/agent/history`, realtime feed). Coordinator-only endpoints return `403`.
- Every React route is wrapped in a guard so unauthenticated users see a login prompt, while role-mismatched users see a gentle access warning. JWT responses now include the user profile for client-side gating.

---

## ☁️ Deploying to Render (single service)

The repo now ships a multi-stage Dockerfile (`backend/Dockerfile`) that builds the Vite frontend and FastAPI backend into a single container. FastAPI serves the compiled SPA from `/` while the APIs remain under their existing routes.

1. **Create one Web Service (Docker)**  
   - Dockerfile path: `backend/Dockerfile`  
   - Build context: repo root (`.`)  
   - Leave Docker Command empty (the Dockerfile already runs Uvicorn).
2. **Environment variables**  
   - Required: `MONGODB_URL` (include `/dbname`), `JWT_SECRET`.  
   - Optional: `LANGFUSE_*`, `OPENAI_API_KEY`, `TWILIO_*`, etc.  
   - Set Render’s **Health Check Path** to `/health` to avoid 404 logs from the default `/`.
3. **Build arguments** (optional)  
   - `VITE_API_BASE_URL` defaults to `/`, so the frontend calls the backend on the same origin. Override via Render’s Docker Build Args if you ever host the API elsewhere.
4. **Deploy**  
   - Render builds the frontend in the first stage, copies `frontend/dist` into the image, and boots FastAPI + Socket.IO on port 8000.  
   - The same URL (e.g., `https://liverlink.onrender.com`) now serves the SPA and JSON APIs.
5. **Smoke test**  
   - Visit `/` for the UI and `/docs` or `/health` for API checks. WebSockets work over the same domain automatically.

Prefer the old split deployment? Keep a separate Static Site using the `scripts/render-frontend-build.sh` helper and point the backend Web Service to `scripts/render-backend-start.sh`. The Docker path above is the new default.

---

## 🩺 Frontend Experience
- **Donor Scan:** html5-qrcode camera, auto-populated donor form, CTA to start allocation.
- **Surgeon Dashboard:** Animated agent card, survival cards, alert feed, confetti on acceptance.
- **Agent Log:** Raw memory stream for audits.

Tech: React 18, Vite, Tailwind, Framer Motion, Lucide icons, Socket.IO client, Zod validators.

---

## 🎥 60-Second Demo Script
```
1. Open Donor Scan → scan wristband (QR).
2. Confirm donor details, hit “Register & Allocate”.
3. Switch to Surgeon Dashboard:
   - Watch AI Agent status animate through Fetch → Predict → Rank.
   - See survival probabilities pulse (red under 60%).
   - Observe live reasoning feed cite MELD, survival, HLA.
4. Wait for alert banner + SMS (mock) → confetti celebrates lock-in.
5. Jump to Agent Log → highlight timeline + LangGraph memory.
6. Show Langfuse trace for the run.
```

---

## 📸 Suggested Screenshots
Create & drop into `docs/` (not committed by default):
- `docs/agent-status.png` – animated card mid-run.
- `docs/survival-ranking.png` – SurvivalCard pulses (<60%).
- `docs/langfuse-trace.png` – Langfuse end-to-end trace.

---

## ✅ Testing & Linting
```bash
# Frontend lint
cd frontend && npm run lint

# Backend tests (add your own pytest suite)
cd backend && pytest
```

---

## 🤝 Contributions
- Add PyTest coverage around agent graph nodes.
- Extend OR tool with real hospital integration.
- Swap heuristic bootstrap model with freshly trained RandomForest via `train_survival.py`.
- Plug Langfuse evals to auto-score reasoning transparency.

---

## 📬 Support
- **Engineering:** bt-labs@liverlink.ai
- **Clinical:** transplant@liverlink.ai

---

Released under the MIT License. Built with ❤️ for transplant coordinators who deserve superpowers.
