"""3D geometry: floor detection and fitting a box around an item's points.

All point maps are metric, in OpenCV camera coordinates (x right, y down,
z forward), as produced by MoGe-2.
"""

from dataclasses import dataclass

import cv2
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

CAMERA_UP = np.array([0.0, -1.0, 0.0])


@dataclass
class Floor:
    normal: np.ndarray  # unit vector pointing up, away from the floor
    offset: float  # height above floor of point p is normal @ p + offset
    found: bool

    def height(self, pts: np.ndarray) -> np.ndarray:
        return pts @ self.normal + self.offset


def edge_mask(depth: np.ndarray, valid: np.ndarray, rel_thresh: float = 0.04) -> np.ndarray:
    """Pixels on depth discontinuities. Their 3D points 'fly' between the
    foreground and background and would inflate the box, so we drop them."""
    d = np.where(valid, depth, np.nan)
    gy, gx = np.gradient(d)
    rel = np.hypot(gx, gy) / np.maximum(d, 1e-3)
    edges = ~np.isfinite(rel) | (rel > rel_thresh)
    return cv2.dilate(edges.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0


def find_floor(points: np.ndarray, valid: np.ndarray, rng: np.random.Generator,
               iters: int = 300, tol: float = 0.03) -> Floor:
    """RANSAC for the floor: a large plane whose normal is roughly 'up' for a
    handheld phone, and which lies below most of the scene."""
    pts = points[valid]
    if len(pts) > 40000:
        pts = pts[rng.choice(len(pts), 40000, replace=False)]
    if len(pts) < 500:
        return Floor(CAMERA_UP, 0.0, False)

    best, best_score = None, 0
    for _ in range(iters):
        a, b, c = pts[rng.choice(len(pts), 3, replace=False)]
        n = np.cross(b - a, c - a)
        norm = np.linalg.norm(n)
        if norm < 1e-6:
            continue
        n /= norm
        if n @ CAMERA_UP < 0:
            n = -n
        # Phone tilted at most ~60 degrees up/down from level.
        if n @ CAMERA_UP < 0.5:
            continue
        off = -(n @ a)
        h = pts @ n + off
        inliers = np.abs(h) < tol
        # The floor is the lowest big plane: penalise planes with lots of
        # points underneath them (tables, beds, sofa seats).
        score = inliers.sum() - 3 * (h < -tol).sum()
        if score > best_score:
            best_score, best = score, (n, off, inliers)

    if best is None or best[2].sum() < 0.05 * len(pts):
        return Floor(CAMERA_UP, 0.0, False)

    # Refine the plane with least squares on its inliers.
    n, off, inliers = best
    inl = pts[inliers]
    centroid = inl.mean(axis=0)
    _, _, vt = np.linalg.svd(inl - centroid, full_matrices=False)
    n2 = vt[2] if vt[2] @ CAMERA_UP > 0 else -vt[2]
    return Floor(n2, float(-(n2 @ centroid)), True)


def clean_points(pts: np.ndarray, rng: np.random.Generator, floor: Floor | None = None,
                 max_pts: int = 4000, voxel: float = 0.05) -> np.ndarray:
    """Remove points that don't belong to the item.

    1. Floor showing between legs is inside the outline but isn't the item, and
       it would bridge the item to whatever stands behind it.
    2. Statistical outlier removal drops isolated stray points.
    3. An item's outline also covers whatever shows through it (the sofa behind
       a coffee table's legs, the wall behind a chair back). Those points form
       separate 3D clusters *behind* the item, so they are dropped. Clusters
       beside or below the item are kept: an office chair's base is split from
       its seat when the thin gas column is lost to edge filtering."""
    if floor is not None and floor.found:
        above = floor.height(pts) > 0.03
        if above.sum() >= 50:
            pts = pts[above]
    if len(pts) > max_pts:
        pts = pts[rng.choice(len(pts), max_pts, replace=False)]
    if len(pts) < 50:
        return pts
    tree = cKDTree(pts)
    dist, _ = tree.query(pts, k=9)
    mean = dist[:, 1:].mean(axis=1)
    pts = pts[mean < mean.mean() + 2.0 * mean.std()]

    idx = np.floor((pts - pts.min(axis=0)) / voxel).astype(np.int64)
    grid = np.zeros(idx.max(axis=0) + 1, dtype=bool)
    grid[tuple(idx.T)] = True
    labels, n = ndimage.label(grid, structure=np.ones((3, 3, 3)))
    if n <= 1:
        return pts
    point_labels = labels[tuple(idx.T)]
    counts = np.bincount(point_labels)
    counts[0] = 0
    main = counts.argmax()
    dist = np.linalg.norm(pts, axis=1)  # distance from the camera
    far_edge = np.percentile(dist[point_labels == main], 90)
    keep = point_labels == main
    for lab in np.nonzero(counts)[0]:
        if lab == main or counts[lab] < 0.03 * len(pts):
            continue
        part = point_labels == lab
        if np.median(dist[part]) < far_edge + 0.1:
            keep |= part
    return pts[keep]


@dataclass
class BoxMeasurement:
    length: float  # longer horizontal side (m)
    width: float  # shorter horizontal side (m)
    height: float  # vertical (m)
    on_floor: bool


def fit_box(pts: np.ndarray, floor: Floor, elevated: bool = False) -> BoxMeasurement | None:
    """Gravity-aligned box: height from the floor normal, footprint from the
    minimum-area rectangle of the points projected onto the floor.

    Furniture stands on the floor even when its bottom isn't visible (thin legs
    are lost to edge filtering, a nightstand's base hides behind the bed), so
    its height is measured from the floor up. `elevated` items (TVs, lamps,
    microwaves...) can sit on other furniture, so they only count as standing
    on the floor when their points actually reach it."""
    if len(pts) < 50:
        return None
    up = floor.normal
    # Orthonormal basis for the floor plane.
    ref = np.array([1.0, 0.0, 0.0]) if abs(up[0]) < 0.9 else np.array([0.0, 0.0, 1.0])
    e1 = np.cross(up, ref)
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(up, e1)

    h = floor.height(pts)
    bottom, top = np.percentile(h, [2, 98])
    on_floor = floor.found and (bottom < 0.12 or not elevated)
    height = top if on_floor else top - bottom

    xy = np.stack([pts @ e1, pts @ e2], axis=1).astype(np.float32)
    (_, _), (_, _), angle = cv2.minAreaRect(xy)
    # Trim 2% at each end along the rectangle's own axes so a few stray
    # points can't stretch the footprint.
    t = np.deg2rad(angle)
    rot = np.array([[np.cos(t), np.sin(t)], [-np.sin(t), np.cos(t)]], dtype=np.float32)
    uv = xy @ rot.T
    lo, hi = np.percentile(uv, [2, 98], axis=0)
    a, b = hi - lo
    length, width = max(a, b), min(a, b)
    return BoxMeasurement(float(length), float(width), float(height), bool(on_floor))
