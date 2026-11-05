"""The AI on Modal (serverless GPU: you pay only while a video is being
processed, and it scales to zero when idle).

    pip install modal
    modal setup                  # one-time login to the workspace
    modal deploy modal_app.py

Only the GPU worker runs here. The main API (website requests, leads, chat,
lead emails) runs on its own server and sends each video to this worker:
start it with SURVEY_GPU=modal (see survey/modal_jobs.py).

`Surveyor` starts on demand and shuts down two minutes after the last video.
`Transcriber` (voice notes from the surveyor app, see survey/transcribe.py) works the
same way: faster-whisper (MIT) with the Whisper large-v3-turbo model (MIT).
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


# ── Voice notes to text (surveyor app) ──────────────────────────────────────

WHISPER_MODEL = "large-v3-turbo"


def _bake_whisper():
    """Download the Whisper weights at build time (about 1.6 GB)."""
    from faster_whisper import download_model

    download_model(WHISPER_MODEL)


# CUDA 12 + cuDNN 9 from NVIDIA's image, which faster-whisper's CTranslate2 needs on the GPU.
whisper_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.12")
    .pip_install("faster-whisper==1.1.1")
    .env({"HF_HOME": "/models/hf"})
    .run_function(_bake_whisper)
)


@app.cls(image=whisper_image, gpu=GPU, timeout=1200, scaledown_window=120)
class Transcriber:
    @modal.enter()
    def load(self):
        from faster_whisper import WhisperModel

        self.model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")

    @modal.method()
    def transcribe(self, audio: bytes, suffix: str) -> dict:
        import os
        import tempfile
        import traceback

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio)
            path = f.name
        try:
            # vad_filter skips silences, where Whisper can otherwise invent words.
            segments, info = self.model.transcribe(path, vad_filter=True, beam_size=5,
                                                   condition_on_previous_text=False)
            text = " ".join(s.text.strip() for s in segments).strip()
            return {"text": text, "language": info.language, "duration": round(info.duration, 1)}
        except Exception:
            traceback.print_exc()
            return {"error": "Couldn't turn this recording into text. Tap Retry."}
        finally:
            os.unlink(path)
