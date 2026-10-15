"""Cloud deployment on Modal (serverless GPU: you pay only while a video is
being processed, and it scales to zero when idle).

    pip install modal
    modal setup                  # one-time login
    modal deploy modal_app.py    # prints the public API URL

Two parts:
- `api`: a small CPU web server (upload, progress polling). Always cheap.
- `Surveyor`: the GPU worker that runs the AI. Starts on demand, shuts down
  two minutes after the last video.
"""

import uuid
from pathlib import Path

import modal

APP_NAME = "ai-room-survey"
GPU = "T4"  # cheapest; "L4" is ~2x faster but Modal needs a card on file for it

app = modal.App(APP_NAME)
progress_store = modal.Dict.from_name(f"{APP_NAME}-jobs", create_if_missing=True)


def _bake_models():
    """Download all model weights and pre-compute the item-name embeddings at
    build time, so containers start fast and never download at runtime."""
    from survey.models import get_models

    get_models()


gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "git", "libgl1", "libglib2.0-0")
    .pip_install("torch==2.6.0", "torchvision==0.21.0", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install(
        "ultralytics==8.4.177",
        "git+https://github.com/ultralytics/CLIP.git",
        "git+https://github.com/microsoft/MoGe.git",
        "lap>=0.5.12",
        "scipy",
        "pyyaml",
        "fastapi[standard]",
        "python-multipart",
    )
    .env({"SURVEY_CACHE": "/models/survey", "HF_HOME": "/models/hf", "YOLO_CONFIG_DIR": "/models/ultralytics"})
    .workdir("/models")
    .add_local_python_source("survey", copy=True, ignore=["**/__pycache__/**"])
    .run_function(_bake_models, gpu=GPU)
)

web_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi[standard]", "python-multipart")
    .add_local_python_source("survey", ignore=["**/__pycache__/**"])
)


@app.cls(image=gpu_image, gpu=GPU, timeout=900, scaledown_window=120)
class Surveyor:
    @modal.enter()
    def load(self):
        from survey.models import get_models

        get_models()

    @modal.method()
    def process(self, job_id: str, video: bytes, suffix: str, room: str) -> dict:
        import os
        import tempfile
        import traceback

        from survey.pipeline import run

        last = {"stage": None, "pct": -1.0}

        def progress(stage: str, pct: float):
            # Throttle writes to the shared store.
            if stage != last["stage"] or pct - last["pct"] >= 0.04:
                last.update(stage=stage, pct=pct)
                progress_store[job_id] = {**progress_store.get(job_id, {}), "stage": stage, "progress": pct,
                                          "status": "running"}

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(video)
            path = f.name
        try:
            return {"result": run(path, room, progress=progress)}
        except ValueError as e:
            return {"error": str(e)}
        except Exception:
            traceback.print_exc()
            return {"error": "Something went wrong while analysing the video."}
        finally:
            os.unlink(path)


class ModalJobs:
    def submit(self, video: bytes, filename: str, room: str) -> str:
        job_id = uuid.uuid4().hex[:12]
        progress_store[job_id] = {"status": "queued", "stage": "Starting the AI (first run can take ~1 min)",
                                  "progress": 0.0}
        call = Surveyor().process.spawn(job_id, video, Path(filename).suffix or ".mp4", room)
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


@app.function(image=web_image)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    from survey.jobs import create_app

    return create_app(ModalJobs())
