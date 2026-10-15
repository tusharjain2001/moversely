"""Loads the two AI models once and keeps them in memory.

- YOLOE-26 (open-vocabulary segmentation): finds every item from the catalog by
  its text name and outlines it. No training needed to add a new item type.
- MoGe-2: turns a single frame into a metric 3D point per pixel.
"""

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from .catalog import load_catalog

CACHE_DIR = Path(os.environ.get("SURVEY_CACHE", Path.home() / ".cache" / "ai-room-survey"))

# Bigger models are more accurate but slower. The defaults suit a cloud GPU;
# set SURVEY_DETECTOR=yoloe-26m-seg.pt / SURVEY_DEPTH=Ruicheng/moge-2-vitb-normal
# for small local GPUs.
DETECTOR_WEIGHTS = os.environ.get("SURVEY_DETECTOR", "yoloe-26l-seg.pt")
DEPTH_WEIGHTS = os.environ.get("SURVEY_DEPTH", "Ruicheng/moge-2-vitl-normal")


@dataclass
class Models:
    detector: object
    depth: object
    device: torch.device
    class_to_item: list[dict]  # detector class index -> catalog item
    fp16: bool

    def depth_infer(self, rgb: np.ndarray, num_tokens: int | None = None) -> dict[str, np.ndarray]:
        t = torch.from_numpy(rgb).to(self.device).permute(2, 0, 1).float() / 255.0
        out = self.depth.infer(t, num_tokens=num_tokens, use_fp16=self.fp16)
        return {
            "points": out["points"].cpu().numpy(),
            "depth": out["depth"].cpu().numpy(),
            "mask": out["mask"].cpu().numpy().astype(bool),
        }


def _text_embeddings(detector, names: list[str]) -> torch.Tensor:
    """Encoding item names needs a 240 MB text model and takes most of the
    start-up time, so the result is cached until the catalog changes."""
    key = hashlib.sha1("|".join([DETECTOR_WEIGHTS, *names]).encode()).hexdigest()[:16]
    path = CACHE_DIR / f"text_pe_{key}.pt"
    if path.exists():
        return torch.load(path)
    pe = detector.get_text_pe(names)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(pe.cpu(), path)
    return pe


_models: Models | None = None


def get_models() -> Models:
    global _models
    if _models is not None:
        return _models

    from moge.model.v2 import MoGeModel
    from ultralytics import YOLOE

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # GTX 16xx cards produce NaNs in fp16; everything newer is fine.
    name = torch.cuda.get_device_name(0) if device.type == "cuda" else ""
    fp16 = device.type == "cuda" and "GTX 16" not in name

    catalog = load_catalog()
    names, class_to_item = [], []
    for item in catalog:
        for prompt in item["prompts"]:
            names.append(prompt)
            class_to_item.append(item)

    detector = YOLOE(DETECTOR_WEIGHTS)
    detector.set_classes(names, _text_embeddings(detector, names))

    depth = MoGeModel.from_pretrained(DEPTH_WEIGHTS).to(device).eval()

    _models = Models(detector, depth, device, class_to_item, fp16)
    return _models
