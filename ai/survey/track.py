"""Links detections across frames so each item gets one ID.

Furniture doesn't move; only the handheld camera does. So instead of predicting
object motion (as general trackers do), we estimate how the whole picture
shifted between frames, move every known box by that much, and match boxes by
overlap. Two passes, as in ByteTrack: confident detections first, then weaker
ones can only continue an existing track, never start a new one.
"""

from dataclasses import dataclass

import cv2
import numpy as np
from scipy.optimize import linear_sum_assignment


def camera_motion(prev_gray: np.ndarray, gray: np.ndarray) -> np.ndarray:
    """2x3 affine moving points in the previous frame to this frame."""
    identity = np.array([[1, 0, 0], [0, 1, 0]], np.float32)
    pts = cv2.goodFeaturesToTrack(prev_gray, maxCorners=400, qualityLevel=0.01, minDistance=12)
    if pts is None or len(pts) < 12:
        return identity
    nxt, status, _ = cv2.calcOpticalFlowPyrLK(prev_gray, gray, pts, None)
    ok = status.ravel() == 1
    if ok.sum() < 12:
        return identity
    m, _ = cv2.estimateAffinePartial2D(pts[ok], nxt[ok], method=cv2.RANSAC, ransacReprojThreshold=3.0)
    return m.astype(np.float32) if m is not None else identity


def warp_box(box: np.ndarray, m: np.ndarray) -> np.ndarray:
    corners = np.array([[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]], np.float32)
    moved = corners @ m[:, :2].T + m[:, 2]
    return np.array([*moved.min(0), *moved.max(0)], np.float32)


def iou_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if len(a) == 0 or len(b) == 0:
        return np.zeros((len(a), len(b)), np.float32)
    x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area_a = (a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1])
    area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    return inter / np.maximum(area_a[:, None] + area_b[None, :] - inter, 1e-6)


def colour_signature(rgb: np.ndarray, box: np.ndarray) -> np.ndarray:
    """Hue/saturation histogram of the box: cheap, and enough to tell a beige
    curtain from a dark wooden cabinet when their boxes overlap."""
    h, w = rgb.shape[:2]
    x1, y1, x2, y2 = (int(np.clip(v, 0, lim)) for v, lim in zip(box, (w, h, w, h)))
    crop = rgb[y1:max(y2, y1 + 2), x1:max(x2, x1 + 2)]
    hsv = cv2.cvtColor(crop, cv2.COLOR_RGB2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [12, 8], [0, 180, 0, 256]).ravel()
    return hist / max(float(hist.sum()), 1e-6)


def colour_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Bhattacharyya distance: 0 same colours, 1 nothing in common."""
    return float(np.sqrt(max(0.0, 1.0 - np.sum(np.sqrt(a * b)))))


@dataclass
class _Live:
    id: int
    box: np.ndarray
    colours: np.ndarray
    lost: int = 0


class Tracker:
    def __init__(self, buffer: int, high: float = 0.35, new: float = 0.35, min_iou: float = 0.25,
                 max_colour_dist: float = 0.55):
        self.buffer = buffer  # frames a lost item is remembered
        self.high, self.new, self.min_iou = high, new, min_iou
        self.max_colour_dist = max_colour_dist
        self.live: list[_Live] = []
        self.next_id = 1
        self.prev_gray: np.ndarray | None = None

    def update(self, rgb: np.ndarray, boxes: np.ndarray, scores: np.ndarray) -> np.ndarray:
        """Track ID per detection (0 = not tracked)."""
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        small = cv2.resize(gray, None, fx=0.5, fy=0.5)
        if self.prev_gray is not None:
            m = camera_motion(self.prev_gray, small)
            m[:, 2] *= 2  # back to full-resolution pixels
            for t in self.live:
                t.box = warp_box(t.box, m)
        self.prev_gray = small

        colours = [colour_signature(rgb, b) for b in boxes]
        ids = np.zeros(len(boxes), int)
        unmatched_tracks = list(range(len(self.live)))
        for pick in (scores >= self.high, scores < self.high):
            dets = np.nonzero(pick)[0]
            if len(dets) == 0 or not unmatched_tracks:
                continue
            cand = [self.live[i] for i in unmatched_tracks]
            iou = iou_matrix(np.array([t.box for t in cand]), boxes[dets])
            dist = np.array([[colour_distance(t.colours, colours[j]) for j in dets] for t in cand])
            # Overlap decides; a clear colour mismatch vetoes the match.
            cost = np.where(dist > self.max_colour_dist, -1.0, iou - 0.3 * dist)
            rows, cols = linear_sum_assignment(-cost)
            used = set()
            for r, c in zip(rows, cols):
                if iou[r, c] < self.min_iou or dist[r, c] > self.max_colour_dist:
                    continue
                t = cand[r]
                j = dets[c]
                t.box, t.lost = boxes[j].astype(np.float32), 0
                t.colours = 0.7 * t.colours + 0.3 * colours[j]
                ids[j] = t.id
                used.add(unmatched_tracks[r])
            unmatched_tracks = [i for i in unmatched_tracks if i not in used]

        for i in unmatched_tracks:
            self.live[i].lost += 1
        for j in np.nonzero((ids == 0) & (scores >= self.new))[0]:
            self.live.append(_Live(self.next_id, boxes[j].astype(np.float32), colours[j]))
            ids[j] = self.next_id
            self.next_id += 1
        self.live = [t for t in self.live if t.lost <= self.buffer]
        return ids
