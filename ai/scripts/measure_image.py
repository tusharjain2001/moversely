"""Dev tool: measure every item in one photo and save an annotated copy.

    python scripts/measure_image.py samples/room.jpg
"""

import sys
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from survey.geometry import clean_points, edge_mask, find_floor, fit_box  # noqa: E402
from survey.models import get_models  # noqa: E402


def main(path: str) -> None:
    m = get_models()
    rgb = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    s = min(1.0, 960 / max(h, w))
    rgb = cv2.resize(rgb, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    h, w = rgb.shape[:2]

    t0 = time.time()
    res = m.detector.predict(rgb, conf=0.25, iou=0.5, agnostic_nms=True, retina_masks=True, verbose=False)[0]
    t1 = time.time()
    geo = m.depth_infer(rgb)
    t2 = time.time()
    print(f"detect {t1 - t0:.2f}s  depth {t2 - t1:.2f}s  device={m.device} fp16={m.fp16}")

    rng = np.random.default_rng(0)
    valid = geo["mask"] & ~edge_mask(geo["depth"], geo["mask"])
    floor = find_floor(geo["points"], valid, rng)
    print(f"floor found={floor.found} normal={np.round(floor.normal, 2)}")

    out = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    if res.masks is None:
        print("no items")
        return
    for cls, conf, mask, box in zip(res.boxes.cls, res.boxes.conf, res.masks.data, res.boxes.xyxy):
        item = m.class_to_item[int(cls)]
        mk = mask.cpu().numpy() > 0.5
        mk = cv2.erode(mk.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        pts = clean_points(geo["points"][mk & valid], rng, floor)
        b = fit_box(pts, floor)
        x1, y1, x2, y2 = map(int, box.tolist())
        label = item["label"]
        if b:
            label += f" {b.length:.2f}x{b.width:.2f}x{b.height:.2f}m"
        print(f"{float(conf):.2f}  {label}  pts={len(pts)}")
        cv2.rectangle(out, (x1, y1), (x2, y2), (0, 200, 255), 2)
        cv2.putText(out, label, (x1 + 3, y1 + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 255), 2)
    dst = Path(path).with_name(Path(path).stem + "_measured.jpg")
    cv2.imwrite(str(dst), out)
    print("saved", dst)


if __name__ == "__main__":
    main(sys.argv[1])
