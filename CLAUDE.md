# MOVERSLY AI Room Survey: project context

Read this first. It records what this project is, how it was built, where it runs, and the decisions
made so far (October 2026). No passwords or keys are in this file; see "Settings and secrets".

## 1. What it is

An instant-booking website for international moves, built for the client **Moversly / APAC Relocation**
(Singapore). The customer:

1. **Your move** (home page form): from (any city/country, Google search), to (Google search), what
   they're moving (full household / partial / a few boxes), date, name, email, phone.
2. **AI survey**: records a short video of each room on their phone (or uploads one). AI finds every
   piece of furniture, measures it in 3D (L × D × H) and adds up the shipment volume (m³ / ft³).
3. **Quotation**: static sample quote (SGD 3,700, 20–35 days transit, partners, terms).
4. **Payment**: simulated checkout (optional insurance at 3% of declared value, two agreement boxes,
   no real card collection), then a boarding-pass style **Move Pass** confirmation.
5. **Documents**: customs documents checklist for leaving the origin and entering the destination
   (10 countries from FIDI customs guides, rewritten in our own words), Save as PDF.

Also: **Talk to AI** (`/chat`, a guided chat that collects the same details and answers moving
questions), **lead emails** to the team, and a password-protected **/admin** leads page.

- **Live site:** https://instant-booking.moversly.com
- **Code:** GitHub `tusharjain2001/moversely` (public), branch `main`. Local folder on the old laptop:
  `C:\Users\Intel\Desktop\ai-room-survey`.

## 2. Architecture (live, on AWS + Modal)

```
Phone ──HTTPS──► instant-booking.moversly.com  (DNS: client's Route 53, A record → 13.229.7.18)
                  │
                  ▼  AWS EC2 "survey" (Singapore, ap-southeast-1, t3.medium, Ubuntu 24.04, 30 GB)
                  Caddy (HTTPS, Let's Encrypt, auto-renew) ─► Next.js website :3000
                                                               └─ /ai/* ─► FastAPI main API :8000
                                                                            ├─► Modal GPU (room videos)
                                                                            ├─► Ollama + Qwen3 1.7B on the same EC2 (chat)
                                                                            ├─► Gmail SMTP (lead emails)
                                                                            └─► DynamoDB "survey-leads" (leads only)
```

- **Website** (`web/`): Next.js 16 + Tailwind v4, Manrope font, Phosphor icons. The browser calls
  `/ai/*` on the same site and Next.js forwards it to the API on port 8000 (`web/next.config.ts`).
- **Main API** (`ai/server_local.py` + `ai/survey/`): FastAPI. Leads, chat, lead emails, admin, and
  room-scan jobs. With `SURVEY_GPU=modal` it loads no AI models; it sends each video to Modal.
- **AI scanning on Modal** (`ai/modal_app.py`): app `ai-room-survey`, class `Surveyor`, T4 GPU, starts
  on demand, shuts down 2 minutes after the last video. Deployed in the client's Modal workspace
  **info-5213** (Starter plan, $30 free credit per month). Main server talks to it with a Modal
  token (`MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`) via `ai/survey/modal_jobs.py`.
- **Database:** DynamoDB table `survey-leads` (partition key `id`, String, on-demand, point-in-time
  backups on). **Only leads are stored.** Chats and survey results are NOT stored: a chat is kept in
  the server's memory while it runs (cleared after a day or on restart), and the survey result is kept
  in memory only so the "survey done" email can include it. Code: `ai/survey/db_dynamo.py`, chosen by
  `DATABASE_URL=dynamodb`. On the laptop/Colab the default is a SQLite file (`ai/data/survey.db`).
- **Chat model:** Qwen3 1.7B via Ollama (custom model `survey-chat` from `ai/chat-model/Modelfile`,
  CPU only). Our code runs the conversation; the model is only asked free-typed questions, and common
  questions (cost, timing, documents, pets, services, privacy) get fixed answers so it can't invent
  prices. OpenAI was planned instead but the client's key isn't ready; switching is only settings:
  `CHAT_AI_URL=https://api.openai.com/v1`, `CHAT_AI_MODEL`, `CHAT_AI_KEY`, `CHAT_AI_EXTRA={}`.

### AI models (all free for commercial use)

| Step | Model |
|---|---|
| Find items by name | OmDet-Turbo (Apache-2.0) + our tracker `ai/survey/track.py` |
| Name each item | SigLIP 2 (Apache-2.0) |
| Outline | SAM 2.1 (Apache-2.0) |
| 3D / metric depth | MoGe-2 (MIT) |

The first prototype used YOLOE/Ultralytics (AGPL licence) and was replaced on 2026-10-17. **Always
raise licence and cost trade-offs before choosing a tool** (the user was upset this wasn't raised early).

Recording limits: in-browser recording 5–90 s (auto-stop at 1:30); server accepts up to 500 MB and
uses the first 180 s. Upload is still allowed (a "record only" option was discussed and postponed).
Speed on Modal T4: about 30–60 s extra for the first scan after idle (GPU start), then ~20–30 s/room.

## 3. Repo layout

| Path | What |
|---|---|
| `web/src/app/` | Pages: `/` home, `/survey`, `/quotation`, `/payment`, `/summary` (documents), `/chat`, `/admin`, 404 |
| `web/src/components/` | `MoveForm` (home form, Google place search for From and To), `SurveyApp`/`RoomSheet`/`CameraRecorder`/`ItemRow` (survey), `Quotation`, `Payment`, `MoveSummary` (documents, `MissingMove`), `ChatApp`, `AdminApp`, `StepHeader` (5-step airline-style stepper), `Booking` (RouteLine SIN ✈ SYD, BookingPanel, mobile BookingSheet, MovePass), `Logo` |
| `web/src/lib/` | `move.ts` (MoveDetails saved in localStorage key `ai-room-survey:move`), `quote.ts` (static prices/partners), `route.ts` (airport/country codes), `places.ts` (Google Places), `countries.ts` (customs data), `crm.ts`/`api.ts` (API calls), `useSurvey*.ts` |
| `web/public/hero/` | Home hero images from Claude Design (`hero-desktop.webp`, `hero-mobile.webp`) |
| `ai/survey/` | `pipeline.py` + `detect.py`/`track.py`/`geometry.py`/`video.py`/`models.py` (AI), `jobs.py` (HTTP API), `crm.py` (leads/chat/admin endpoints), `chat.py` (Talk to AI), `notify.py` (emails), `db.py` (SQL) / `db_dynamo.py`, `modal_jobs.py`, `catalog.json` (~40 items), `customs/` |
| `ai/modal_app.py` | Modal GPU worker deploy |
| `ai/server_local.py` | Runs the main API (local GPU, or Modal with `SURVEY_GPU=modal`) |
| `ai/requirements.txt` / `requirements-server.txt` | Full AI install / light server install (no torch) |
| `deploy/` | EC2: `setup.sh` (one-time), `update.sh` (deploy latest), systemd services, `server.env.example`, `create-tables.sh`, IAM role JSON |
| `colab/ai-room-survey-colab.ipynb` | Whole demo on free Colab T4 (uses Colab Secrets) |
| `start-demo.bat` + `tools/cloudflared.exe` | Old laptop demo with a Cloudflare quick-tunnel link |
| `docs/` | Client overview PDF, accuracy report |
| `fidi-guides/` | FIDI PDFs (gitignored: "may not be reproduced") |

## 4. How it was built (timeline)

1. **Prototype on the laptop** (mid-Oct 2026): video → furniture sizes. Old laptop: GTX 1650 4 GB,
   6 GB RAM, so `SURVEY_DEPTH=Ruicheng/moge-2-vitb-normal`, fp16 off. Demos via `start-demo.bat`
   (Cloudflare quick tunnel; link changes each restart; use `--protocol http2` for stability).
   No payment card at first, so Modal was blocked then.
2. Client asked for the 3-step flow (form → survey → documents); customs summaries for 10 countries.
3. Talk to AI + leads + /admin; Qwen3 1.7B via Ollama.
4. Google Colab notebook to run everything on a free T4 (pulls code from GitHub each run).
5. Lead emails via Gmail SMTP app password (`ai/survey/notify.py`); test with `python -m survey.notify`.
6. Google Places search for "Moving to" (Maps JavaScript API + classic Places API).
7. Blue/white rebrand (#0A66C2, MOVERSLY. logo with teal dot), quotation page, payment page, back navigation.
8. **Hosting decisions:** website + main API on the client's AWS (EC2), AI GPU on Modal (pay per second
   vs ~$380+/month for an always-on AWS GPU), DynamoDB suggested by the client, OpenAI planned for chat.
9. **Modal deployed** (only the GPU worker) and tested from the laptop: 64 s first scan, 28 s warm.
10. **AWS deployment by hand in the console** (no access keys needed for the console; later keys were
    created for the CLI). Client gave permissions in steps (IAM user `tushar`). Created: DynamoDB table,
    IAM role `survey-server-role` (DynamoDB access only), EC2 `survey` + security group (SSH from my IP
    only, HTTP/HTTPS open) + Elastic IP 13.229.7.18 (named "survey"). Ran `deploy/setup.sh`, filled
    settings, `deploy/update.sh`. Client's team added the DNS record; HTTPS turned on automatically.
11. Client asked to store **only leads** in DynamoDB (not chats/survey results).
12. **Claude Design redesign** (airline / flight-booking feel): stepper, "Your booking" fare summary,
    flight-style route line, Move Pass, new hero image. Built into the real code without changing features.
13. "Moving from" is no longer fixed to Singapore: Google search like "To"; origin partner APAC
    Relocation shows only for Singapore, others "Local partner (to be confirmed)".
14. Talk to AI: first question "Where are you moving from?"; pets and car/motorbike questions removed.

## 5. Running and deploying

### Update the live site
1. Push to GitHub `main`.
2. `ssh -i <path>\survey-key.pem ubuntu@13.229.7.18`
3. `bash /opt/survey/deploy/update.sh` (git pull, install, build website, restart; ~2–4 min; site may
   error for a minute while building). It writes the Caddyfile from `SITE_DOMAIN` in `/opt/survey/ai/.env`.

Useful on the server: `sudo journalctl -u survey-api -n 40 --no-pager` (API; should say "Videos are
analysed on Modal."), `sudo journalctl -u survey-web -n 40`, `sudo journalctl -u caddy -n 30`,
`sudo systemctl restart survey-api survey-web`. Code lives in `/opt/survey`.

### Update the Modal GPU worker (only if the AI scanning code changes)
From a laptop logged in to the info-5213 workspace: `cd ai` then `.venv\Scripts\python -m modal deploy modal_app.py`.
The EC2 server picks up the new version automatically.

### Run locally (website + API, scans on Modal)
- Website: `cd web`, `npm install`, `npx next dev -p 3000` → http://localhost:3000
- API: `cd ai`, `.venv\Scripts\python server_local.py` (with `SURVEY_GPU=modal` in `ai/.env` and Modal
  login done) → http://localhost:8000. Chat free-questions need Ollama running.
- The phone camera needs HTTPS, so on localhost test scans with "Upload a video" (`ai/samples/pan_living.mp4`).
- The home form remembers the last details typed in that browser (localStorage); use a private window to see it empty.

### Set up a new laptop
1. `git clone https://github.com/tusharjain2001/moversely.git`
2. Website: Node 22 (`nvm use 22`), `cd web && npm install`, create `web/.env.local`.
3. API: Python 3.12, `cd ai && python -m venv .venv`, then `.venv\Scripts\pip install -r requirements-server.txt`
   (enough when scans go to Modal) or the full `requirements.txt` + torch (only to run AI locally on an NVIDIA GPU).
4. Create `ai/.env` (see below), `.venv\Scripts\python -m modal setup` and pick workspace **info-5213**.
5. Optional: AWS CLI (`aws configure`, region ap-southeast-1), Ollama + `ollama create survey-chat -f chat-model/Modelfile`.
6. Copy `survey-key.pem` (the EC2 SSH key) to `C:\Users\<you>\.ssh\` from the old laptop. Never commit it.
   If SSH times out, your IP changed: EC2 → Security Groups → the survey group → set the SSH rule to "My IP".

## 6. Settings and secrets (values are NOT in the repo)

Never commit `ai/.env`, `web/.env.local`, `~/.modal.toml`, `~/.aws/`, or the `.pem` key.

| File | Keys |
|---|---|
| `ai/.env` (laptop) | `ADMIN_PASSWORD`, `SMTP_USER`, `SMTP_PASSWORD` (Gmail app password), optional `LEAD_EMAIL_TO`, `SURVEY_GPU=modal`, `SURVEY_DEPTH` (local GPU only), `HF_HUB_DISABLE_SYMLINKS_WARNING=1`, `TRANSFORMERS_VERBOSITY=error` |
| `/opt/survey/ai/.env` (EC2) | `SITE_DOMAIN=instant-booking.moversly.com` (domain only, no http://), `ADMIN_PASSWORD`, `DATABASE_URL=dynamodb`, `AWS_REGION=ap-southeast-1`, `SURVEY_GPU=modal`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`, optional `LEAD_EMAIL_TO`, optional `CHAT_AI_*` for OpenAI |
| `web/.env.local` (laptop and EC2) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (if the key is restricted by website, allow the live domain) |
| Colab Secrets | `SMTP_USER`, `SMTP_PASSWORD`, `LEAD_EMAIL_TO`, `SMTP_HOST`, `SMTP_PORT`, `GOOGLE_MAPS_API_KEY` |

`ai/.env` is read once at start-up: restart the API after changing it. If a key appears twice, the first one wins.

## 7. Costs (approx.)

- AWS: ~$45/month (t3.medium ~$38, 30 GB disk ~$3, Elastic IP ~$4, DynamoDB cents).
- Modal: T4 $0.59/hour, billed per second, $0 when idle; Starter plan includes $30 free credit per month
  (~45–50 GPU hours). Each room scan costs cents.

## 8. Working rules and preferences

- The user wants **simple English, step-by-step instructions**, and often asks what to tell the client.
- **Never add "Co-Authored-By: Claude" or "Generated with Claude Code"** lines to commits or PRs.
- **Commit and push only when the user says "push"**; then remind them to run `update.sh` on the server.
- Never put secrets in chat, screenshots, the public repo or the Colab notebook.
- Don't edit files with PowerShell `Get-Content`/`Set-Content` (it scrambles UTF-8 symbols like ×, ³, →).
- Shell scripts and systemd files must keep LF line endings (`.gitattributes` enforces it).
- Payment is a simulation: never collect real card details until a licensed payment provider is added.
- Don't promise stored chat transcripts: chats are not saved.
- Before building anything big, check licence and cost; open-source models only, no paid AI tokens for the survey.
- The user is cautious with the client's live AWS: read-only checks first, show commands before running them,
  never touch the client's other servers or Elastic IPs (they have 7 other EC2 instances in Singapore: Website, n8n-flow, samudra-website, api-v1…, and 3 unnamed).

## 9. Open items and ideas

- Talk to AI's "from"/"to" only accept the 10 customs countries (typing "Hong Kong" is rejected);
  the website form accepts any place. Offered: accept any country in the chat too.
- Switch the chat to OpenAI once the client provides a key (settings only).
- Real payment provider; real pricing/partner API (quote is static).
- Accuracy still to be validated against tape-measured furniture.
- Optional: daily EBS snapshot policy and a billing alert; remove temporary admin permissions from the
  IAM user when setup is finished; make the GitHub repo private or move it to Moversly's GitHub.
- Record-only (no upload) option was discussed and postponed.
