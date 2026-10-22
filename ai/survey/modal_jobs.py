"""Sends room videos to the Surveyor GPU worker deployed on Modal (see
modal_app.py), so only the AI runs on Modal while leads, chat and lead emails
stay on the main server (this computer now, AWS later).

The main server uses it when SURVEY_GPU=modal. It needs the Modal token of the
workspace the worker is deployed to: run `modal setup` on that machine, or set
MODAL_TOKEN_ID and MODAL_TOKEN_SECRET.
"""

import uuid
from pathlib import Path

import modal

APP_NAME = "ai-room-survey"
# Progress reported by the GPU worker, read back by the main server.
progress_store = modal.Dict.from_name(f"{APP_NAME}-jobs", create_if_missing=True)


class ModalJobs:
    def submit(self, video: bytes, filename: str, room: str) -> str:
        job_id = uuid.uuid4().hex[:12]
        progress_store[job_id] = {"status": "queued", "stage": "Starting the AI (first run can take ~1 min)",
                                  "progress": 0.0}
        surveyor = modal.Cls.from_name(APP_NAME, "Surveyor")()
        call = surveyor.process.spawn(job_id, video, Path(filename).suffix or ".mp4", room)
        progress_store[job_id] = {**progress_store[job_id], "call_id": call.object_id}
        return job_id

    def status(self, job_id: str) -> dict | None:
        info = progress_store.get(job_id)
        if not info or "call_id" not in info:
            return None
        base = {k: info.get(k) for k in ("status", "stage", "progress")}
        try:
            out = modal.FunctionCall.from_id(info["call_id"]).get(timeout=0)
        except TimeoutError:
            return base
        except modal.exception.OutputExpiredError:
            return None
        except Exception:
            return {**base, "status": "error", "error": "The AI worker stopped unexpectedly. Please try again."}
        if "error" in out:
            return {**base, "status": "error", "error": out["error"]}
        return {"status": "done", "stage": "Done", "progress": 1.0, "result": out["result"]}
