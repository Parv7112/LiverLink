from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict

import socketio
from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pymongo.errors import PyMongoError

from .agents.organ_allocation_agent import AgentEvent, OrganAllocationAgent
from .database import db
from .memory.allocation_memory import allocation_memory
from .routers import auth, donor, patient
from .utils.security import hash_password


class LiveUpdateHub:
    def __init__(self, sio_server: socketio.AsyncServer) -> None:
        self.sio = sio_server
        self.websockets: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.websockets.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.websockets.discard(websocket)

    async def notify(self, event: str, payload: Dict[str, Any]) -> None:
        message = {"event": event, "payload": payload}
        stale = []
        for connection in self.websockets:
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)
        await self.sio.emit(event, payload)

    async def agent_event(self, event: AgentEvent) -> None:
        await self.notify(event.type, event.payload)


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="LiverLink API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

hub = LiveUpdateHub(sio)
agent = OrganAllocationAgent(hub.agent_event)

donor.init_router(agent, hub)

app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(donor.router)


@app.get("/health")
async def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/agent/allocate")
async def trigger_allocation(
    payload: Dict[str, Any],
    _: Dict[str, Any] = Depends(auth.get_current_user),
) -> JSONResponse:
    qr_code_id = payload.get("qr_code_id")
    organ = payload.get("organ", "liver")
    if not qr_code_id:
        return JSONResponse({"detail": "qr_code_id required"}, status_code=400)

    async def _run_agent() -> None:
        await hub.notify("allocation_triggered", payload)
        await agent.run({"qr_code_id": qr_code_id, "organ": organ}, surgeon_phone="+15551234567")

    asyncio.create_task(_run_agent())
    return JSONResponse({"status": "started", "qr_code_id": qr_code_id})


@app.get("/agent/history")
async def agent_history(limit: int = 10, _: Dict[str, Any] = Depends(auth.get_current_user)) -> Dict[str, Any]:
    entries = await allocation_memory.history(limit)
    for entry in entries:
        if "donor" in entry and entry["donor"].get("_id"):
            entry["donor"]["_id"] = str(entry["donor"]["_id"])
    return {"history": entries}


@app.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket) -> None:
    await hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(websocket)


@sio.event
async def connect(sid, environ):  # pragma: no cover - socket handshake
    await hub.notify("socket_connected", {"sid": sid})


@sio.event
async def disconnect(sid):  # pragma: no cover - socket handshake
    await hub.notify("socket_disconnected", {"sid": sid})


socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.on_event("startup")
async def ensure_demo_user() -> None:
    users = db.get_collection("users")
    try:
        existing = await users.find_one({"email": "demo@liverlink.ai"})
        if not existing:
            await users.insert_one(
                {
                    "email": "demo@liverlink.ai",
                    "name": "Demo Surgeon",
                    "password": hash_password("demo123"),
                    "role": "surgeon",
                }
            )
    except PyMongoError as exc:  # pragma: no cover - external service
        logger.warning("MongoDB unavailable; skipping demo user seeding: {}", exc)


DIST_DIR = Path(__file__).resolve().parent.parent / "frontend_dist"
INDEX_FILE = DIST_DIR / "index.html"
ASSETS_DIR = DIST_DIR / "assets"

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


def spa_available() -> bool:
    return INDEX_FILE.exists()


@app.get("/", include_in_schema=False)
async def serve_root() -> JSONResponse | FileResponse:
    if spa_available():
        return FileResponse(INDEX_FILE)
    return JSONResponse({"status": "ok", "message": "frontend bundle missing; API operational"})


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str) -> FileResponse | JSONResponse:
    if not spa_available():
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    candidate = DIST_DIR / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(INDEX_FILE)

