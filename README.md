# AI Room Survey — prototype

Record a short video of each room. The AI finds every piece of furniture, measures its
length × depth × height in 3D, and adds up the shipment volume (ft³ / m³).

- **No LLM tokens.** Everything runs on open-source vision models, so the only running cost is
  GPU time while a video is processed (seconds per room).
- **Works on any phone.** The website records video in the browser (or takes an uploaded video);
  no app install, no LiDAR needed.

```
 Phone browser ──► Next.js site (Vercel) ── UI only
       │
       └── video ──► AI API (Modal GPU, or this PC) ──► items + sizes
```

## How the AI measures

| Step | What happens | Tech |
|---|---|---|
| 1. Frames | Video sampled at 5 frames/second | ffmpeg |
| 2. Find & track | Every catalog item is found by name and outlined; each item keeps one ID through the video so it is counted once | YOLOE-26 (open-vocabulary segmentation) + BoT-SORT tracker with camera-motion compensation |
| 3. Best views | Per item, up to 5 sharp, fully visible frames from different moments (= different angles) | — |
| 4. 3D | Each chosen frame becomes a metric 3D point cloud; the floor is found and cross-checked across frames | MoGe-2 (Microsoft, MIT licence) |
| 5. Measure | Points that aren't the item are removed (floor between legs, things seen *through* the item), then a gravity-aligned box is fitted | numpy / scipy / OpenCV |
| 6. Combine | Views are merged per item; scale is calibrated if a door (US standard 80″) or dining table is in the video | — |
| 7. Sanity check | Sides the camera couldn't see get the item's typical size; implausible sizes are flagged; confusable items are relabelled by size (a 1.8 m "table lamp" → floor lamp) | `ai/survey/catalog.json` |

Each item comes back with a confidence badge: **Measured** (several clear views), **Check size**
(partly estimated) or **Estimate** (seen briefly). The customer can edit any size.

The catalog (`ai/survey/catalog.json`) lists ~40 moving items. Adding a new item type is one line:
no training needed.

## Run it on this PC

**AI server** (needs an NVIDIA GPU; first start downloads ~2 GB of models):

```bash
cd ai
python -m venv .venv
.venv\Scripts\pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
.venv\Scripts\pip install -r requirements.txt
# small GPU (4 GB): use the mid-size depth model
set SURVEY_DEPTH=Ruicheng/moge-2-vitb-normal
.venv\Scripts\python server_local.py          # http://localhost:8000
```

**Website:**

```bash
cd web
npm install
npm run dev                                    # http://localhost:3000
```

Locally, leave `NEXT_PUBLIC_AI_API_URL` unset: the site forwards `/ai/*` to the AI server on `http://localhost:8000`, so one link serves both. For a public demo from this laptop, run `start-demo.bat` (it opens a free Cloudflare link).

Dev tools: `python scripts/run_video.py video.mp4` prints results for a video;
`python scripts/measure_image.py photo.jpg` measures one photo and saves an annotated copy.

## Deploy so the client can test from their phone

### 1. AI API → Modal (serverless GPU)

```bash
cd ai
.venv\Scripts\modal setup                      # one-time: log in (free account)
.venv\Scripts\modal deploy modal_app.py
```

The deploy prints a URL like `https://<you>--ai-room-survey-api.modal.run`. Check it with
`<url>/health`. The first build takes ~10 minutes (it bakes the models into the image).

- GPU: NVIDIA T4 (set `GPU = "L4"` in modal_app.py for ~2x speed), starts on demand, shuts down 2 minutes after the last video. The first video
  after idle waits ~30–60 s for the GPU to start.
- Optional: restrict who can call the API with `SURVEY_ALLOWED_ORIGINS=https://your-site.vercel.app`.

### 2. Website → Vercel

1. Push this folder to GitHub, then import it in Vercel.
2. **Root Directory:** `web`
3. **Environment variable:** `NEXT_PUBLIC_AI_API_URL` = the Modal URL from step 1.
4. Deploy. The in-browser camera needs HTTPS, which Vercel provides.

## Known limits (prototype)

- One phone video gives ~10–15% size error per item when the floor and a door are visible;
  this must be checked against tape-measured furniture (see below).
- If the camera walks back to an item it already passed, it can be counted twice; the
  customer removes it in the review list. (Next step: full 3D room reconstruction fixes this.)
- YOLOE (Ultralytics) is AGPL-3.0: fine for a prototype; production needs an Ultralytics
  licence or a swap to an Apache-licensed detector. MoGe-2 is MIT.

## Accuracy test before showing the client

1. Pick one room. Tape-measure 5–10 pieces of furniture (L × D × H).
2. Record the room with the site (slowly, include a door, floor visible).
3. Compare the AI sizes with the tape. Report the average error per item and for the room total.
