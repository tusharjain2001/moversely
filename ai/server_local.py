"""Run the AI API on this computer (for development or a live demo).

    .venv\\Scripts\\python server_local.py
    -> http://localhost:8000

Jobs run one at a time on a single worker thread and are kept in memory.
With SURVEY_GPU=modal, videos are analysed by the worker deployed on Modal
(modal_app.py) instead, so this computer needs no GPU and loads no models.
Settings (database, chat model, admin password) come from ai/.env; see
.env.example.
"""

import os
import tempfile
import threading
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


def _load_env(path: Path) -> None:
    """KEY=value lines; real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and not key.strip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


_load_env(Path(__file__).with_name(".env"))

import uvicorn  # noqa: E402

from survey.jobs import create_app  # noqa: E402


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
        from survey.pipeline import run

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
    from survey import chat

    threading.Thread(target=chat.warm, daemon=True).start()
    if os.environ.get("SURVEY_GPU", "").lower() == "modal":
        from survey.modal_jobs import ModalJobs

        backend = ModalJobs()
        print("Videos are analysed on Modal.")
    else:
        from survey.models import get_models

        get_models()  # load before the first request instead of during it
        backend = LocalJobs()
    uvicorn.run(create_app(backend), host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", 8000)))
