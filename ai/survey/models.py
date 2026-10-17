"""Loads the AI models once and keeps them in memory. All are free for
commercial use.

- OmDet-Turbo (Apache-2.0): finds every catalog item by its text name.
- SigLIP 2 (Apache-2.0): names each found item from close-up crops.
- SAM 2.1 (Apache-2.0): outlines a found item exactly.
- MoGe-2 (MIT): turns a single frame into a metric 3D point per pixel.
"""

import os
from dataclasses import dataclass

import numpy as np
import torch

from .catalog import load_catalog
from .detect import Detector, Namer, Segmenter

# Bigger models are more accurate but slower. The default suits a cloud GPU;
# set SURVEY_DEPTH=Ruicheng/moge-2-vitb-normal for small local GPUs.
DEPTH_WEIGHTS = os.environ.get("SURVEY_DEPTH", "Ruicheng/moge-2-vitl-normal")


@dataclass
class Models:
    detector: Detector
    namer: Namer
    segmenter: Segmenter
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


_models: Models | None = None


def get_models() -> Models:
    global _models
    if _models is not None:
        return _models

    from moge.model.v2 import MoGeModel

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # GTX 16xx cards produce NaNs in fp16; everything newer is fine.
    name = torch.cuda.get_device_name(0) if device.type == "cuda" else ""
    fp16 = device.type == "cuda" and "GTX 16" not in name

    names, class_to_item = [], []
    for item in load_catalog():
        for prompt in item["prompts"]:
            names.append(prompt)
            class_to_item.append(item)

    detector = Detector(names, device, fp16)
    namer = Namer(names, device)
    segmenter = Segmenter(device)
    depth = MoGeModel.from_pretrained(DEPTH_WEIGHTS).to(device).eval()

    _models = Models(detector, namer, segmenter, depth, device, class_to_item, fp16)
    return _models
