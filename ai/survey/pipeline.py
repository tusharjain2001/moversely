"""Room video -> list of items with real-world sizes.

Stages
1. Frames: sample the video at a fixed rate.
2. Track: OmDet-Turbo finds every catalog item in every frame by its name; our
   tracker (with camera-motion compensation) links them so each item gets one ID.
3. Views: for each item, pick a few sharp, fully visible frames from different
   moments (= different angles).
4. Measure: SAM 2.1 outlines the item in those frames and MoGe-2 gives metric
   3D points; we find the floor and fit a gravity-aligned box to the item's
   points in each view.
5. Combine: merge the views per item, calibrate the overall scale against
   objects of standard size (doors), then sanity-check against the catalog.

No LLM is involved, so there is no per-token cost.
"""

import base64
import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable

import cv2
import numpy as np
import torch

from .catalog import load_catalog
from .geometry import Floor, clean_points, edge_mask, find_floor, fit_box
from .models import Models, get_models
from .track import Tracker
from .video import extract_frames, sharpness

M3_TO_FT3 = 35.3147
TRACK_FPS = float(os.environ.get("SURVEY_TRACK_FPS", 5))
MAX_DEPTH_FRAMES = int(os.environ.get("SURVEY_MAX_DEPTH_FRAMES", 48))
DEPTH_TOKENS = int(os.environ["SURVEY_DEPTH_TOKENS"]) if os.environ.get("SURVEY_DEPTH_TOKENS") else None
VIEWS_PER_ITEM = 5
MIN_OUTLINE_QUALITY = 0.5
MIN_VIEW_GAP_S = 0.6

Progress = Callable[[str, float], None]


@dataclass
class Det:
    frame: int
    cls: int
    conf: float
    box: np.ndarray  # x1, y1, x2, y2
    area: float  # box area as a fraction of the frame
    cut_lr: bool  # touches the left/right frame edge: length/depth may be cut off
    cut_tb: bool  # touches the top/bottom frame edge: height may be cut off

    @property
    def border(self) -> bool:
        return self.cut_lr or self.cut_tb


@dataclass
class Track:
    dets: list[Det] = field(default_factory=list)
    item: dict | None = None
    views: list[dict] = field(default_factory=list)  # one box measurement per view

    @property
    def start(self) -> int:
        return self.dets[0].frame

    @property
    def end(self) -> int:
        return self.dets[-1].frame


def _track(models: Models, frames: list[np.ndarray], progress: Progress) -> dict[int, Track]:
    tracker = Tracker(buffer=int(TRACK_FPS * 6))
    tracks: dict[int, Track] = defaultdict(Track)
    h, w = frames[0].shape[:2]
    for i, frame in enumerate(frames):
        boxes, scores, classes = models.detector(frame)
        # The detector sometimes boxes most of the scene (curtain, chair and
        # desk together). A real close-up of one item is detected confidently.
        areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1]) / (w * h)
        keep = (areas < 0.5) | (scores >= 0.5)
        boxes, scores, classes = boxes[keep], scores[keep], classes[keep]
        for tid, cls, conf, box in zip(tracker.update(frame, boxes, scores), classes, scores, boxes):
            if tid == 0:
                continue
            x1, y1, x2, y2 = box
            area = float((x2 - x1) * (y2 - y1)) / (w * h)
            tracks[int(tid)].dets.append(Det(i, int(cls), float(conf), box, area,
                                             x1 < 4 or x2 > w - 4, y1 < 4 or y2 > h - 4))
        if i % 10 == 0:
            progress("Finding items", 0.10 + 0.40 * i / len(frames))
    return dict(tracks)


def _crop(rgb: np.ndarray, box: np.ndarray, pad: float = 0.1) -> np.ndarray:
    """Box plus a margin, widened so it is at most 2:1. The namer squashes
    every crop to a square, and a squashed sliver of lamp looks like nothing."""
    h, w = rgb.shape[:2]
    x1, y1, x2, y2 = box
    bw, bh = x2 - x1, y2 - y1
    px = bw * pad + max(0.0, bh / 2 - bw) / 2
    py = bh * pad + max(0.0, bw / 2 - bh) / 2
    return rgb[int(max(0, y1 - py)):int(min(h, y2 + py)), int(max(0, x1 - px)):int(min(w, x2 + px))]


def _name_items(models: Models, frames: list[np.ndarray], tracks: dict[int, Track], sharp: np.ndarray) -> None:
    """The detector is good at where things are, less so at what they are. Name
    each track from up to three clear, well-spread close-ups instead, averaging
    the namer's scores. Tracks that look like a non-item (curtain, laptop...)
    get no item and are dropped."""
    sharp_norm = sharp / max(float(np.median(sharp)), 1e-6)
    crops, owner = [], []
    for tid, t in tracks.items():
        if len(t.dets) < 2:
            continue
        ranked = sorted(t.dets, key=lambda d: (not d.border, d.area * d.conf * min(sharp_norm[d.frame], 2.0)),
                        reverse=True)
        picked: list[Det] = []
        for d in ranked:
            if all(abs(d.frame - p.frame) >= 3 for p in picked):
                picked.append(d)
            if len(picked) == 3:
                break
        for d in picked:
            crop = _crop(frames[d.frame], d.box)
            if min(crop.shape[:2]) >= 24:
                crops.append(crop)
                owner.append(tid)
    if not crops:
        return
    logits = np.concatenate([models.namer(crops[i:i + 32]) for i in range(0, len(crops), 32)])
    owner = np.array(owner)
    for tid in set(owner.tolist()):
        best = int(logits[owner == tid].mean(0).argmax())
        tracks[tid].item = models.class_to_item[best] if best < len(models.class_to_item) else None


def _merge_fragments(tracks: dict[int, Track], fps: float, size: tuple[int, int]) -> list[Track]:
    """Join tracks of the same item that the tracker split (it lost the item for
    a moment and gave it a new ID): same item type, starts shortly after the
    other ends, near where it was last seen."""
    diag = float(np.hypot(*size))
    ordered = sorted(tracks.values(), key=lambda t: t.start)
    merged: list[Track] = []
    for t in ordered:
        target = None
        for m in merged:
            if m.item["key"] != t.item["key"] or not (0 < t.start - m.end <= fps * 2.5):
                continue
            a, b = m.dets[-1].box, t.dets[0].box
            ca, cb = (a[:2] + a[2:]) / 2, (b[:2] + b[2:]) / 2
            if np.linalg.norm(ca - cb) < 0.2 * diag:
                target = m
                break
        if target:
            target.dets.extend(t.dets)
        else:
            merged.append(t)
    return merged


def _keep(t: Track) -> bool:
    """Real items are seen in several frames with at least one clear detection."""
    confs = [d.conf for d in t.dets]
    return len(t.dets) >= 3 and max(confs) >= 0.35 and float(np.mean(confs)) >= 0.25


def _pick_views(tracks: list[Track], sharp: np.ndarray, fps: float) -> dict[int, list[tuple[Track, Det]]]:
    """Choose which frames get the (expensive) 3D step and which item views to
    measure in each. Prefer sharp, large, uncut views spread over time."""
    sharp_norm = sharp / max(float(np.median(sharp)), 1e-6)
    wanted: list[list[Det]] = []
    for t in tracks:
        # Fully visible views first; views cut by the frame edge still measure
        # the sides that aren't cut, so they fill the remaining slots.
        cands = sorted(t.dets, key=lambda d: (not d.border, np.sqrt(d.area) * d.conf * min(sharp_norm[d.frame], 2.0)),
                       reverse=True)
        picked: list[Det] = []
        for d in cands:
            if sharp_norm[d.frame] < 0.35 and picked:
                continue
            if all(abs(d.frame - p.frame) >= MIN_VIEW_GAP_S * fps for p in picked):
                picked.append(d)
            if len(picked) == VIEWS_PER_ITEM:
                break
        wanted.append(picked)

    # Budget the 3D step: every item gets its best view first, then frames that
    # serve the most items are added until the budget is spent.
    chosen: set[int] = {p[0].frame for p in wanted if p}
    counts: dict[int, int] = defaultdict(int)
    for picks in wanted:
        for d in picks:
            counts[d.frame] += 1
    for f in sorted(counts, key=lambda f: (-counts[f], -sharp[f])):
        if len(chosen) >= MAX_DEPTH_FRAMES:
            break
        chosen.add(f)

    by_frame: dict[int, list[tuple[Track, Det]]] = defaultdict(list)
    for t, picks in zip(tracks, wanted):
        for d in picks:
            if d.frame in chosen:
                by_frame[d.frame].append((t, d))
    return dict(sorted(by_frame.items()))


def _check_floors(floors: dict[int, Floor]) -> dict[int, Floor]:
    """The phone is held at about the same height all through the video, so
    the camera's height above a correctly found floor is about the same in
    every frame. A 'floor' that disagrees is really a table top or bed, and is
    dropped rather than trusted."""
    heights = [fl.offset for fl in floors.values() if fl.found]
    if not heights:
        return floors
    ref = float(np.median(heights))
    out = {}
    for f, fl in floors.items():
        ok = fl.found and 0.4 < fl.offset < 2.4 and abs(fl.offset - ref) < max(0.25, 0.2 * ref)
        out[f] = fl if ok else Floor(fl.normal, fl.offset, False)
    return out


def _measure(models: Models, frames: list[np.ndarray], by_frame: dict, progress: Progress) -> None:
    kernel = np.ones((5, 5), np.uint8)
    floors: dict[int, Floor] = {}
    raw: list[tuple[Track, Det, np.ndarray]] = []
    for n, (f, views) in enumerate(by_frame.items()):
        rgb = frames[f]
        rng = np.random.default_rng(f)
        geo = models.depth_infer(rgb, num_tokens=DEPTH_TOKENS)
        valid = geo["mask"] & ~edge_mask(geo["depth"], geo["mask"])
        floors[f] = find_floor(geo["points"], valid, rng)
        outlines = models.segmenter(rgb, [d.box for _, d in views])
        for (t, d), (outline, quality) in zip(views, outlines):
            # A box spanning several things (half a curtain and a chair back)
            # has no clean outline; measuring it would mix their sizes.
            if quality < MIN_OUTLINE_QUALITY:
                continue
            mask = cv2.erode(outline.astype(np.uint8), kernel) > 0
            pts = geo["points"][mask & valid]
            if len(pts) > 8000:
                pts = pts[rng.choice(len(pts), 8000, replace=False)]
            raw.append((t, d, pts))
        progress("Measuring in 3D", 0.55 + 0.33 * (n + 1) / len(by_frame))

    # Boxes are fitted once every frame's floor has been cross-checked.
    floors = _check_floors(floors)
    for t, d, pts in raw:
        floor = floors[d.frame]
        rng = np.random.default_rng(d.frame)
        box = fit_box(clean_points(pts, rng, floor), floor, elevated=bool(t.item.get("elevated")))
        if box:
            t.views.append({"frame": d.frame, "l": box.length, "w": box.width, "h": box.height,
                            "on_floor": box.on_floor, "floor": floor.found,
                            "cut_lr": d.cut_lr, "cut_tb": d.cut_tb, "border": d.border})


def _fuse(t: Track) -> tuple[float, float, float] | None:
    """One size per item from several views. A single view only ever sees part
    of an item, so its sides come out too short, never too long (outliers are
    already removed). Taking the upper part of the spread recovers sides that
    were only visible from some angles."""
    if not t.views:
        return None
    # Each side comes only from views where that side isn't cut by the frame.
    flat = [v for v in t.views if not v["border"]] or [v for v in t.views if not v["cut_lr"]] or t.views
    tall = [v for v in t.views if not v["cut_tb"]] or t.views
    # Heights measured from a floor are more reliable (they include hidden
    # legs and bases), so they count twice.
    hs = [v["h"] for v in tall for _ in range(2 if v["floor"] else 1)]
    q = 70 if len(flat) >= 3 else 50
    return (float(np.percentile([v["l"] for v in flat], q)), float(np.percentile([v["w"] for v in flat], q)),
            float(np.median(hs)))


def _calibrate(sized: list[tuple[Track, tuple[float, float, float]]]) -> tuple[float, str]:
    """Single-image depth is right to within roughly 10-20%. Objects with a
    standard height (US interior doors are 80 in) fix the scale of the whole
    video. Without one, sizes are left as measured."""
    ratios, weights, used = [], [], set()
    for t, (_, _, h) in sized:
        ref = t.item.get("anchor_height")
        if ref and h > 0 and any(v["floor"] and v["on_floor"] for v in t.views):
            r = ref / h
            if 0.6 < r < 1.6:
                ratios.append(r)
                weights.append(t.item.get("anchor_weight", 1.0))
                used.add(t.item["label"].lower())
    if sum(weights) >= 0.5:
        order = np.argsort(ratios)
        cum = np.cumsum(np.array(weights)[order])
        r = float(np.array(ratios)[order][np.searchsorted(cum, cum[-1] / 2)])
        return float(np.clip(r, 0.75, 1.33)), " + ".join(sorted(used))
    return 1.0, "none"


def _range_miss(dims: tuple[float, float, float], item: dict) -> float:
    """How far a size falls outside an item's plausible range (0 = inside).
    The short side is often hidden, so only penalise it for being too long."""
    miss = 0.0
    for i, v in enumerate(dims):
        lo, hi = item["min"][i], item["max"][i]
        if v > hi:
            miss += np.log(v / hi)
        elif v < lo and i != 1:
            miss += np.log(lo / v)
    return miss


def _relabel(item: dict, dims, catalog: list[dict]) -> dict:
    """Swap to a sibling item type when the size clearly says so, e.g. a 'table
    lamp' that is 1.8 m tall is a floor lamp, a 0.45 m tall 'dining table' is
    a coffee table."""
    fam = item.get("family")
    if not fam:
        return item
    own = _range_miss(dims, item)
    if own < 0.1:
        return item
    best = min((c for c in catalog if c.get("family") == fam), key=lambda c: _range_miss(dims, c))
    return best if _range_miss(dims, best) < own - 0.1 else item


def _sanity(dims, item: dict) -> tuple[list[float], list[str]]:
    """Replace sides the camera couldn't see with the item's typical size and
    flag anything implausible. Small decor that may sit on furniture keeps its
    measured length and height: a 30 cm plant on a nightstand is real."""
    l, w, h = dims
    notes = []
    lo, hi, typ = item["min"], item["max"], item["typical"]
    if w < lo[1]:
        notes.append("Back/side not visible, depth estimated from typical size")
        w = typ[1]
    if not item.get("elevated"):
        if l < lo[0] * 0.7:
            notes.append("Only partly visible, length estimated from typical size")
            l = typ[0]
        if h < lo[2] * 0.7:
            notes.append("Height looked too small, typical height used")
            h = typ[2]
    big = [name for name, v, m in (("length", l, hi[0]), ("depth", w, hi[1]), ("height", h, hi[2])) if v > m * 1.3]
    if big:
        notes.append(f"Unusually large {' / '.join(big)}, please check")
    l, w = max(l, w), min(l, w)
    return [round(l, 2), round(w, 2), round(h, 2)], notes


def _thumbnail(models: Models, rgb: np.ndarray, d: Det) -> str:
    h, w = rgb.shape[:2]
    outline = models.segmenter(rgb, [d.box])[0][0].astype(np.uint8)
    x1, y1, x2, y2 = d.box
    px, py = (x2 - x1) * 0.08, (y2 - y1) * 0.08
    x1, y1 = int(max(0, x1 - px)), int(max(0, y1 - py))
    x2, y2 = int(min(w, x2 + px)), int(min(h, y2 + py))
    crop = rgb[y1:y2, x1:x2].copy()
    contours, _ = cv2.findContours(outline[y1:y2, x1:x2], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(crop, contours, -1, (255, 196, 0), 2, cv2.LINE_AA)
    s = 320 / max(crop.shape[:2])
    if s < 1:
        crop = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 80])
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()


def _best_det(t: Track, sharp: np.ndarray) -> Det:
    whole = [d for d in t.dets if not d.border] or t.dets
    return max(whole, key=lambda d: d.area * d.conf * min(sharp[d.frame] / max(float(np.median(sharp)), 1e-6), 2.0))


def run(video_path: str, room: str = "Room", progress: Progress | None = None) -> dict:
    progress = progress or (lambda stage, pct: None)
    t0 = time.time()
    progress("Loading AI models", 0.02)
    models = get_models()
    catalog = [c for c in load_catalog() if c.get("inventory", True)]

    progress("Reading video", 0.05)
    frames, times = extract_frames(video_path, fps=TRACK_FPS)
    if len(frames) < 3:
        raise ValueError("The video is too short. Please record at least 5 seconds.")
    sharp = np.array([sharpness(f) for f in frames])
    h, w = frames[0].shape[:2]

    with torch.inference_mode():
        progress("Finding items", 0.10)
        raw = _track(models, frames, progress)
        _name_items(models, frames, raw, sharp)
        raw = {tid: t for tid, t in raw.items() if t.item}
        tracks = [t for t in _merge_fragments(raw, TRACK_FPS, (w, h)) if _keep(t)]

        progress("Measuring in 3D", 0.55)
        by_frame = _pick_views(tracks, sharp, TRACK_FPS)
        _measure(models, frames, by_frame, progress)

    progress("Calculating volume", 0.92)
    sized = [(t, dims) for t in tracks if (dims := _fuse(t))]
    scale, scale_method = _calibrate(sized)

    items = []
    for t, dims in sized:
        if not t.item.get("inventory", True):
            continue
        dims = tuple(v * scale for v in dims)
        # Only let the size overrule the name when the size is trustworthy:
        # seen whole, with the floor in view, more than once.
        solid = sum(1 for v in t.views if v["floor"] and not v["border"]) >= 2
        item = _relabel(t.item, dims, catalog) if solid else t.item
        final, notes = _sanity(dims, item)
        n_views = len(t.views)
        whole = any(not v["border"] for v in t.views)
        estimated = any("estimated" in n or "typical" in n for n in notes)
        confidence = ("high" if n_views >= 3 and whole and not notes
                      else "low" if n_views == 1 or (estimated and not whole) or any("check" in n for n in notes)
                      else "medium")
        best = _best_det(t, sharp)
        vol = final[0] * final[1] * final[2]
        items.append({
            "key": item["key"],
            "label": item["label"],
            "dims_m": final,
            "volume_m3": round(vol, 3),
            "volume_ft3": round(vol * M3_TO_FT3, 1),
            "confidence": confidence,
            "notes": notes,
            "views": n_views,
            "seen_at_s": round(times[best.frame], 1),
            "thumbnail": _thumbnail(models, frames[best.frame], best),
        })

    items.sort(key=lambda it: -it["volume_m3"])
    for i, it in enumerate(items):
        it["id"] = f"{room.lower().replace(' ', '-')}-{i + 1}"
    total = sum(it["volume_m3"] for it in items)
    progress("Done", 1.0)
    return {
        "room": room,
        "items": items,
        "summary": {
            "item_count": len(items),
            "total_volume_m3": round(total, 2),
            "total_volume_ft3": round(total * M3_TO_FT3, 1),
        },
        "calibration": {"method": scale_method, "factor": round(scale, 3)},
        "stats": {
            "video_seconds": round(times[-1], 1),
            "frames_tracked": len(frames),
            "frames_measured_3d": len(by_frame),
            "processing_seconds": round(time.time() - t0, 1),
            "device": str(models.device),
        },
    }
