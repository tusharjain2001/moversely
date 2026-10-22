"""The AI on Modal (serverless GPU: you pay only while a video is being
processed, and it scales to zero when idle).

    pip install modal
    modal setup                  # one-time login to the workspace
    modal deploy modal_app.py

Only the GPU worker runs here. The main API (website requests, leads, chat,
lead emails) runs on its own server and sends each video to this worker:
start it with SURVEY_GPU=modal (see survey/modal_jobs.py).

`Surveyor` starts on demand and shuts down two minutes after the last video.
"""

import modal

from survey.modal_jobs import APP_NAME, progress_store

GPU = "T4"  # cheapest; "L4" is ~2x faster but Modal needs a card on file for it

app = modal.App(APP_NAME)


def _bake_models():
    """Download all model weights at build time, so containers start fast and
    never download at runtime."""
    from survey.models import get_models

    get_models()


gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "git", "libgl1", "libglib2.0-0")
    .pip_install("torch==2.6.0", "torchvision==0.21.0", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install(
        "transformers==5.20.1",
        "timm==1.0.30",
        "git+https://github.com/microsoft/MoGe.git",
        "opencv-python-headless",
        "scipy",
        "sqlalchemy==2.0.55",
        "psycopg[binary]",
        "httpx",
        "fastapi[standard]",
        "python-multipart",
    )
    .env({"HF_HOME": "/models/hf"})
    .workdir("/models")
    .add_local_python_source("survey", copy=True, ignore=["**/__pycache__/**"])
    .run_function(_bake_models, gpu=GPU)
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
