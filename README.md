# AI Room Survey — prototype

Record a short video of each room. The AI finds every piece of furniture, measures its
length × depth × height in 3D, and adds up the shipment volume (ft³ / m³).

- **No paid AI tokens.** Everything runs on open-source models on our own server, so the only running cost is
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
| 2. Find & track | Every catalog item is found by name; each item keeps one ID through the video so it is counted once | OmDet-Turbo (open-vocabulary detector, Apache-2.0) + our own tracker with camera-motion compensation and a colour check (`ai/survey/track.py`) |
| 2b. Name | Each tracked item is named from 3 clear close-ups; non-items (curtains, laptops, rugs) are dropped | SigLIP 2 (Google, Apache-2.0) |
| 3. Best views | Per item, up to 5 sharp, fully visible frames from different moments (= different angles) | — |
| 4. Outline + 3D | The item is outlined in each chosen frame, and the frame becomes a metric 3D point cloud; the floor is found and cross-checked across frames | SAM 2.1 (Meta, Apache-2.0) + MoGe-2 (Microsoft, MIT) |
| 5. Measure | Points that aren't the item are removed (floor between legs, things seen *through* the item), then a gravity-aligned box is fitted | numpy / scipy / OpenCV |
| 6. Combine | Views are merged per item; scale is calibrated if a door (US standard 80″) or dining table is in the video | — |
| 7. Sanity check | Sides the camera couldn't see get the item's typical size; implausible sizes are flagged; confusable items are relabelled by size (a 1.8 m "table lamp" → floor lamp) | `ai/survey/catalog.json` |

Each item comes back with a confidence badge: **Measured** (several clear views), **Check size**
(partly estimated) or **Estimate** (seen briefly). The customer can edit any size.

The catalog (`ai/survey/catalog.json`) lists ~40 moving items. Adding a new item type is one line:
no training needed.

## Talk to AI, leads and the team page

- **`/chat`**: a chat that collects the move details (route, what's moving, car, pets, date,
  name, email, phone), answers moving questions, then opens the room survey. Our code runs the
  conversation and checks every answer; the chat model (Qwen3 1.7B, Apache-2.0, run by Ollama) is
  only asked free-form questions. Common questions (cost, timing, documents, pets, services,
  privacy) get fixed answers from our own data, so a small model can't invent prices or rules.
  Code: `ai/survey/chat.py`.
- **Leads**: every chat and every homepage form is saved, and the survey total is added once the
  visitor reaches the documents page. Code: `ai/survey/db.py`, endpoints in `ai/survey/crm.py`.
- **`/admin`**: password-protected list of leads with the full chat (`ADMIN_PASSWORD` in `ai/.env`).

Customs summaries live in `ai/survey/customs/` (the chat uses them); `npm run sync:customs` copies
them to the website.

## Moving to a real server

Everything that differs between this laptop and a server is a setting (`ai/.env` locally,
environment variables on a server; see `ai/.env.example`):

| Setting | This laptop | Real server |
|---|---|---|
| `DATABASE_URL` | unset: SQLite file `ai/data/survey.db` | `postgresql+psycopg://user:pass@host:5432/db` (Supabase, Neon, AWS RDS, a VPS…); `pip install "psycopg[binary]"` |
| `CHAT_AI_URL` / `CHAT_AI_MODEL` | Ollama here, `survey-chat` | any OpenAI-style endpoint: Ollama or vLLM on a GPU server, a model host, or a paid API |
| `CHAT_AI_KEY` | unset | the service's API key, if any |
| `CHAT_AI_EXTRA` | turns off Qwen3 "thinking" | `{}` for services that don't accept `reasoning_effort` |
| `ADMIN_PASSWORD` | in `ai/.env` | a strong password |
| `NEXT_PUBLIC_AI_API_URL` (website) | unset: `/ai` forwarded to localhost:8000 | the AI server's public URL |

1. Create the Postgres database and set `DATABASE_URL`. Tables are created on first start.
2. Optional, to keep the leads collected so far:
   `python scripts/copy_db.py sqlite:///data/survey.db postgresql+psycopg://...`
3. Run the chat model where the AI server can reach it and set `CHAT_AI_URL` / `CHAT_AI_MODEL`.
4. Deploy the AI server and the website as below.

## Run it on a free Google Colab GPU (demos)

`colab/ai-room-survey-colab.ipynb` runs everything (AI server, chat model, website) on a free T4
GPU and prints one public link; the laptop can be off. Open the notebook in Colab, choose a T4 GPU
and **Run all**. It downloads the newest code from GitHub each time, so a pushed change only needs
another **Run all**. Leads are backed up to `My Drive/ai-room-survey/` every minute. Free Colab stops after ~90 idle minutes or ~12
hours, and the link changes each session, so it's for demos, not hosting.

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
- Every model is free for commercial use: OmDet-Turbo, SigLIP 2 and SAM 2.1 are Apache-2.0,
  MoGe-2 is MIT. (The first prototype used YOLOE, which is AGPL; it was replaced on 2026-10-17.)
- The detector boxes items well but mixes up similar furniture, which is why a separate
  model names them. Names can still be wrong for items seen only at the frame edge.

## Accuracy test before showing the client

1. Pick one room. Tape-measure 5–10 pieces of furniture (L × D × H).
2. Record the room with the site (slowly, include a door, floor visible).
3. Compare the AI sizes with the tape. Report the average error per item and for the room total.
