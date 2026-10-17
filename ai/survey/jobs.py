"""HTTP API shared by the local server and the Modal deployment.

    POST /jobs        multipart: video=<file>, room=<name>   -> {"job_id"}
    GET  /jobs/{id}   -> {"status": queued|running|done|error, "stage", "progress", "result"?, "error"?}
    GET  /catalog     -> the item catalog (for manual "Add item")
    GET  /health
    plus chat, leads and admin endpoints (see crm.py)

Processing a room takes from several seconds to a few minutes, so the upload
returns at once and the browser polls for progress.
"""

import os
from typing import Protocol

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from .catalog import load_catalog
from .crm import router as crm_router

MAX_UPLOAD_MB = int(os.environ.get("SURVEY_MAX_UPLOAD_MB", 500))
VIDEO_TYPES = ("video/", "application/octet-stream")


class JobBackend(Protocol):
    def submit(self, video: bytes, filename: str, room: str) -> str: ...
    def status(self, job_id: str) -> dict | None: ...


def create_app(backend: JobBackend) -> FastAPI:
    app = FastAPI(title="AI Room Survey")
    origins = [o.strip() for o in os.environ.get("SURVEY_ALLOWED_ORIGINS", "*").split(",")]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])
    app.include_router(crm_router)

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/catalog")
    def catalog():
        return [{k: c[k] for k in ("key", "label", "typical")} for c in load_catalog() if c.get("inventory", True)]

    @app.post("/jobs")
    async def create_job(video: UploadFile = File(...), room: str = Form("Room")):
        if video.content_type and not video.content_type.startswith(VIDEO_TYPES):
            raise HTTPException(415, "Please upload a video file.")
        data = await video.read()
        if not data:
            raise HTTPException(400, "The video is empty.")
        if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(413, f"The video is larger than {MAX_UPLOAD_MB} MB. Please record a shorter clip.")
        job_id = await run_in_threadpool(backend.submit, data, video.filename or "video.mp4",
                                         room.strip()[:40] or "Room")
        return {"job_id": job_id}

    @app.get("/jobs/{job_id}")
    def get_job(job_id: str):
        status = backend.status(job_id)
        if status is None:
            raise HTTPException(404, "Unknown job.")
        return status

    return app
