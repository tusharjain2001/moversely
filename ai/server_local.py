"""Run the AI API on this computer's GPU (for development or a live demo).

    .venv\\Scripts\\python server_local.py
    -> http://localhost:8000

Jobs run one at a time on a single worker thread and are kept in memory.
"""

import os
import tempfile
import threading
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import uvicorn

from survey.jobs import create_app
from survey.models import get_models
from survey.pipeline import run


class LocalJobs:
    def __init__(self):
        self.jobs: dict[str, dict] = {}
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=1)

    def _update(self, job_id: str, **fields):
        with self.lock:
            self.jobs[job_id].update(fields)

    def submit(self, video: bytes, filename: str, room: str) -> str:
        job_id = uuid.uuid4().hex[:12]
        with self.lock:
            self.jobs[job_id] = {"status": "queued", "stage": "Waiting in queue", "progress": 0.0}
        self.pool.submit(self._work, job_id, video, Path(filename).suffix or ".mp4", room)
        return job_id

    def _work(self, job_id: str, video: bytes, suffix: str, room: str):
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(video)
            path = f.name
        try:
            self._update(job_id, status="running")
            result = run(path, room, progress=lambda stage, pct: self._update(job_id, stage=stage, progress=pct))
            self._update(job_id, status="done", stage="Done", progress=1.0, result=result)
        except ValueError as e:
            self._update(job_id, status="error", error=str(e))
        except Exception:
            traceback.print_exc()
            self._update(job_id, status="error", error="Something went wrong while analysing the video.")
        finally:
            os.unlink(path)

    def status(self, job_id: str) -> dict | None:
        with self.lock:
            job = self.jobs.get(job_id)
            return dict(job) if job else None


if __name__ == "__main__":
    get_models()  # load before the first request instead of during it
    uvicorn.run(create_app(LocalJobs()), host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
