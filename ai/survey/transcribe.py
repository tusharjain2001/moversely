"""Voice notes to text for the surveyor app (Whisper on the Modal GPU).

    POST /transcribe        multipart: audio=<file>  -> {"job_id"}
    GET  /transcribe/{id}   -> {"status": queued|running|done|error, "text"?, "language"?, "error"?}

The audio goes straight to the `Transcriber` worker in modal_app.py (faster-whisper, MIT,
model large-v3-turbo, MIT) and is not saved here. Only the job id and Modal call id are
kept in memory, so after a server restart the app gets 404 and offers Retry.
Needs SURVEY_GPU=modal; without it the endpoints answer 503.
"""

import os
import threading
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

MAX_AUDIO_MB = int(os.environ.get("SURVEY_MAX_AUDIO_MB", 100))
AUDIO_TYPES = ("audio/", "video/mp4", "application/octet-stream")
KEEP_SECONDS = 24 * 3600

router = APIRouter()
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _enabled() -> bool:
    return os.environ.get("SURVEY_GPU", "").lower() == "modal"


def _forget_old():
    cutoff = time.time() - KEEP_SECONDS
    with _lock:
        for k in [k for k, v in _jobs.items() if v["created"] < cutoff]:
            _jobs.pop(k, None)


def _spawn(audio: bytes, suffix: str) -> str:
    import modal

    from .modal_jobs import APP_NAME

    transcriber = modal.Cls.from_name(APP_NAME, "Transcriber")()
    return transcriber.transcribe.spawn(audio, suffix).object_id


def _status(call_id: str) -> dict:
    import modal

    try:
        out = modal.FunctionCall.from_id(call_id).get(timeout=0)
    except TimeoutError:
        return {"status": "running"}
    except modal.exception.OutputExpiredError:
        return {"status": "error", "error": "The transcript expired. Tap Retry."}
    except Exception:
        return {"status": "error", "error": "The transcript service stopped unexpectedly. Tap Retry."}
    if "error" in out:
        return {"status": "error", "error": out["error"]}
    return {"status": "done", "text": out.get("text", ""), "language": out.get("language")}


@router.post("/transcribe")
async def create_transcript(audio: UploadFile = File(...)):
    if not _enabled():
        raise HTTPException(503, "Transcripts are not switched on on this server.")
    if audio.content_type and not audio.content_type.startswith(AUDIO_TYPES):
        raise HTTPException(415, "Please upload an audio file.")
    data = await audio.read()
    if not data:
        raise HTTPException(400, "The recording is empty.")
    if len(data) > MAX_AUDIO_MB * 1024 * 1024:
        raise HTTPException(413, f"The recording is larger than {MAX_AUDIO_MB} MB.")
    _forget_old()
    call_id = await run_in_threadpool(_spawn, data, Path(audio.filename or "audio.m4a").suffix or ".m4a")
    job_id = uuid.uuid4().hex[:12]
    with _lock:
        _jobs[job_id] = {"call_id": call_id, "created": time.time()}
    return {"job_id": job_id}


@router.get("/transcribe/{job_id}")
async def get_transcript(job_id: str):
    with _lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown transcript.")
    return await run_in_threadpool(_status, job["call_id"])
