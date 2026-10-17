"""Finding, naming and outlining items, using only permissively licensed models.

- OmDet-Turbo (Apache-2.0): open-vocabulary detector. It finds every catalog
  item from its text name, so adding an item type needs no training. It is
  good at *where* things are but often mixes up similar furniture.
- SigLIP 2 (Apache-2.0): names each found item from a few close-up crops, and
  recognises non-items (curtains, rugs, laptops...) so they can be dropped.
- SAM 2.1 (Apache-2.0): turns a detected box into the item's exact outline.
  Outlines are only needed for the few frames that get measured in 3D, so SAM
  runs on those alone instead of on every frame.
"""

import os

import cv2
import numpy as np
import torch
from torchvision.ops import nms

DETECTOR_WEIGHTS = os.environ.get("SURVEY_DETECTOR", "omlab/omdet-turbo-swin-tiny-hf")
NAMER_WEIGHTS = os.environ.get("SURVEY_NAMER", "google/siglip2-base-patch16-224")
SEGMENTER_WEIGHTS = os.environ.get("SURVEY_SEGMENTER", "facebook/sam2.1-hiera-small")

# Things the detector boxes that are not furniture to move. Naming them lets
# the namer say "that's a curtain" instead of forcing a furniture label.
NOT_ITEMS = [
    "curtain", "window", "wall", "floor", "ceiling", "rug", "carpet", "person",
    "laptop", "computer keyboard", "computer mouse", "headphones", "bottle",
    "cushion", "pillow", "blanket", "bed sheet", "clothes", "bag", "towel",
    "kitchen counter", "built-in kitchen cabinets", "air conditioner", "radiator",
    "light switch", "ceiling light", "staircase", "railing",
]


class Detector:
    def __init__(self, names: list[str], device: torch.device, fp16: bool):
        from transformers import AutoProcessor, OmDetTurboForObjectDetection

        self.names = names
        self.device = device
        self.dtype = torch.float16 if fp16 else torch.float32
        self.processor = AutoProcessor.from_pretrained(DETECTOR_WEIGHTS)
        # The model caches each class name's text encoding; keep them all.
        self.model = OmDetTurboForObjectDetection.from_pretrained(
            DETECTOR_WEIGHTS, cache_size=max(100, len(names) * 2), dtype=self.dtype
        ).to(device).eval()
        # The task prompt steers the detector. Listing 60 names would be cut
        # off by the text encoder, so describe the scene instead.
        self.task = "Detect furniture, appliances and household items in a room."

    @torch.inference_mode()
    def __call__(self, rgb: np.ndarray, threshold: float = 0.2) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Boxes (x1, y1, x2, y2 in pixels), scores and class indices."""
        h, w = rgb.shape[:2]
        inputs = self.processor(images=rgb, text=[self.names], task=self.task, return_tensors="pt").to(self.device)
        if self.dtype != torch.float32:
            inputs["pixel_values"] = inputs["pixel_values"].to(self.dtype)
        out = self.model(**inputs)
        res = self.processor.post_process_grounded_object_detection(
            out, target_sizes=[(h, w)], threshold=threshold, nms_threshold=0.5
        )[0]
        boxes, scores, labels = res["boxes"].float(), res["scores"].float(), res["labels"]
        # One box per object whatever its label: "sofa" and "couch" often both fire.
        keep = nms(boxes, scores, 0.5)
        return boxes[keep].cpu().numpy(), scores[keep].cpu().numpy(), labels[keep].cpu().numpy().astype(int)


def _pooled(out) -> torch.Tensor:
    """Feature getters return a tensor in older transformers, an output object in newer."""
    return out if isinstance(out, torch.Tensor) else out.pooler_output


class Namer:
    """Zero-shot classifier over the catalog names plus NOT_ITEMS."""

    def __init__(self, names: list[str], device: torch.device):
        from transformers import AutoModel, AutoProcessor

        self.device = device
        self.labels = names + NOT_ITEMS
        self.n_items = len(names)
        self.processor = AutoProcessor.from_pretrained(NAMER_WEIGHTS)
        model = AutoModel.from_pretrained(NAMER_WEIGHTS).to(device).eval()
        with torch.inference_mode():
            text = self.processor(text=[f"This is a photo of a {n}." for n in self.labels],
                                  padding="max_length", max_length=64, return_tensors="pt").to(device)
            self.text = torch.nn.functional.normalize(_pooled(model.get_text_features(**text)), dim=-1)
        self.scale, self.bias = model.logit_scale.exp(), model.logit_bias
        # The text side is only needed once; keep just the image side on the GPU.
        del model.text_model
        self.model = model
        torch.cuda.empty_cache()

    @torch.inference_mode()
    def __call__(self, crops: list[np.ndarray]) -> np.ndarray:
        """Logits (crops x labels); higher means a better match."""
        inputs = self.processor(images=crops, return_tensors="pt").to(self.device)
        img = torch.nn.functional.normalize(_pooled(self.model.get_image_features(**inputs)), dim=-1)
        return (img @ self.text.T * self.scale + self.bias).float().cpu().numpy()


class Segmenter:
    def __init__(self, device: torch.device):
        from transformers import Sam2Model, Sam2Processor

        self.device = device
        self.processor = Sam2Processor.from_pretrained(SEGMENTER_WEIGHTS)
        self.model = Sam2Model.from_pretrained(SEGMENTER_WEIGHTS).to(device).eval()

    @torch.inference_mode()
    def __call__(self, rgb: np.ndarray, boxes: list[np.ndarray]) -> list[tuple[np.ndarray, float]]:
        """Per box: a boolean mask (frame size) and SAM's confidence that it is
        one coherent object (low when the box spans several things)."""
        if not boxes:
            return []
        inputs = self.processor(
            images=rgb, input_boxes=[[[float(v) for v in b] for b in boxes]], return_tensors="pt"
        ).to(self.device)
        out = self.model(**inputs, multimask_output=True)
        masks = self.processor.post_process_masks(out.pred_masks.cpu(), inputs["original_sizes"])[0]
        scores = out.iou_scores[0].float().cpu().numpy()
        results = []
        for cand, sc in zip(masks, scores):
            # SAM offers whole-object and part-of-object outlines. Among the
            # ones it is nearly as sure of as its best, take the largest: we
            # measure whole items, not their cushions or drawers.
            areas = cand.flatten(1).sum(1).numpy()
            ok = np.nonzero(sc >= sc.max() - 0.12)[0]
            j = int(ok[np.argmax(areas[ok])])
            results.append((_tidy(cand[j].numpy().astype(bool)), float(sc[j])))
        return results


def _tidy(mask: np.ndarray) -> np.ndarray:
    """Drop specks: keep connected parts holding at least 5% of the mask."""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    if n <= 2:
        return mask
    areas = stats[1:, cv2.CC_STAT_AREA]
    keep = np.nonzero(areas >= 0.05 * areas.sum())[0] + 1
    return np.isin(labels, keep)
