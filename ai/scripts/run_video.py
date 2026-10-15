"""Dev tool: run the full survey pipeline on a video and print the results.

    python scripts/run_video.py path/to/room.mp4 [room name]
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from survey.pipeline import run  # noqa: E402


def main() -> None:
    video = sys.argv[1]
    room = sys.argv[2] if len(sys.argv) > 2 else "Room"
    result = run(video, room, progress=lambda stage, pct: print(f"  {pct:4.0%}  {stage}", flush=True))
    for it in result["items"]:
        l, w, h = it["dims_m"]
        print(f"{it['label']:<26} {l:.2f} x {w:.2f} x {h:.2f} m  {it['volume_ft3']:6.1f} ft3  "
              f"{it['confidence']:<6} views={it['views']}  {'; '.join(it['notes'])}")
    print(json.dumps({k: v for k, v in result.items() if k != "items"}, indent=2))
    out = Path(video).with_suffix(".result.json")
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("saved", out)


if __name__ == "__main__":
    main()
