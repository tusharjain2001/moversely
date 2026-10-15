"""Turn an uploaded video into a list of RGB frames at a fixed rate."""

import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np


def sharpness(rgb: np.ndarray) -> float:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def extract_frames(video_path: str, fps: float = 5.0, max_side: int = 960,
                   max_seconds: float = 180.0) -> tuple[list[np.ndarray], list[float]]:
    """Returns (frames, timestamps). ffmpeg handles phone rotation metadata and
    every container/codec phones produce (mov/HEVC, mp4/H.264, webm/VP9)."""
    if shutil.which("ffmpeg"):
        return _extract_ffmpeg(video_path, fps, max_side, max_seconds)
    return _extract_opencv(video_path, fps, max_side, max_seconds)


def _extract_ffmpeg(video_path, fps, max_side, max_seconds):
    scale = (f"scale='if(gte(iw,ih),min({max_side},iw),-2)':"
             f"'if(gte(iw,ih),-2,min({max_side},ih))'")
    with tempfile.TemporaryDirectory() as tmp:
        cmd = ["ffmpeg", "-v", "error", "-y", "-t", str(max_seconds), "-i", video_path,
               "-vf", f"fps={fps},{scale}", "-q:v", "2", str(Path(tmp) / "%05d.jpg")]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            raise ValueError(f"Could not read the video: {proc.stderr.strip()[:300]}")
        files = sorted(Path(tmp).glob("*.jpg"))
        frames = [cv2.cvtColor(cv2.imread(str(f)), cv2.COLOR_BGR2RGB) for f in files]
    return frames, [i / fps for i in range(len(frames))]


def _extract_opencv(video_path, fps, max_side, max_seconds):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not read the video.")
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, round(src_fps / fps))
    frames, times, i = [], [], 0
    while True:
        ok, bgr = cap.read()
        if not ok or i / src_fps > max_seconds:
            break
        if i % step == 0:
            h, w = bgr.shape[:2]
            s = min(1.0, max_side / max(h, w))
            if s < 1.0:
                bgr = cv2.resize(bgr, (round(w * s) // 2 * 2, round(h * s) // 2 * 2),
                                 interpolation=cv2.INTER_AREA)
            frames.append(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            times.append(i / src_fps)
        i += 1
    cap.release()
    return frames, times
