# Kintsugi: guide for Claude

Kintsugi is a hackathon entry (AI Builder Cup, Sustainability track, submission due 18 Oct 2026): "Google Maps for the circular economy". Five Gemini agents (Oracle, Scout, Architect, Market, Ledger) find the best next life for anything filmed on a phone and close the deal in each person's language. The design is in `docs/implementation.md`; the ordered task list is in `NEXT_STEPS.md`. Work from `NEXT_STEPS.md` unless the user asks for something else.

## Layout

- `backend/` FastAPI API, Python 3.11+. Entry `app/main.py`; flows in `app/agents.py`.
  - `app/llm/` model layer: `base.py` (interface), `gemini.py` (live, Vertex AI), `mock.py` (offline fixtures), `prompts.py`, `schemas.py`
  - `app/ladder.py` next-life decision rules; `app/negotiation.py` seller/buyer agents and guardrails; `app/a2a_seller.py` seller agent over A2A
  - `app/ledger.py`, `app/materials.py`, `app/certificate.py` impact accounting; `app/evidence.py` evidence frames with face blur
  - `app/store/` memory and Firestore stores behind one interface; `app/demo/fixtures.py` sample data (Bengaluru), `app/demo/cities.py` sample Asia-Pacific cities
  - `app/live_ledger.py` the live ledger feed; `app/report_pdf.py` PDF report and certificates (fonts in `app/fonts/`); `app/standing.py` account standing; `app/speech_cache.py` cached Gemini voices
  - `kintsugi_adk/agent.py` the same tools as an ADK multi-agent app (`adk web`)
  - `tests/` pytest, all offline; `eval/` Scout accuracy harness; `scripts/smoke_live.py` checks live Gemini calls
- `frontend/` React + TypeScript + Vite. `src/App.tsx` shell; screens in `src/components/`; API client `src/api.ts`; design tokens at the top of `src/styles.css`
- `android/` Capacitor Android app that runs the frontend (generated; edit `frontend/` and sync, not `android/app/src/main/assets`)
- `infra/` Google Cloud setup and deploy scripts; `firebase.json` hosting with `/api` and `/a2a` rewrites to Cloud Run

## Commands

```bash
# backend (from backend/)
python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8080      # MOCK_MODE=true by default (.env)
pytest -q                                       # must pass before every commit

# frontend (from frontend/)
npm install && npm run dev                      # http://localhost:5173, proxies /api and /a2a to :8080
npx tsc -b && npm run build                     # must pass before every commit
npm run android:sync                            # rebuild and copy into the Android app
```

## Rules that keep the project working

1. **Mock mode always works.** The app, tests and judge mode must run with no Google credentials. Every new model call is added to `llm/base.py`, implemented in both `gemini.py` and `mock.py`, and covered by an offline test.
2. **Code decides, the model explains.** The ladder order, thresholds, prices' limits and hazard handling are enforced in Python, never only in a prompt.
3. **Private limits stay private.** `floor_price_inr` (seller) and `budget_cap_inr` (buyer) never appear in API responses (`public_item` in `main.py`, the participant dump in `/api/state`). Guardrail notes say a limit held, never its value. The seller's floor is read only inside `a2a_seller.py`.
4. **Hazards are never routed to reuse.** Suspected hazards go to a licensed handler with "professional testing required".
5. **Every number has a source.** CO2 figures carry their emission factor and source; prices carry their sources. Sample data is labelled (`synthetic`, "Sample data" badge, "sample data" price source).
6. **Faces are blurred** before any image is stored or shown (`evidence.blur_faces`). Raw uploads are only read by Gemini.
7. **Home locations are approximate** (about 500 m) until a deal is sold.
8. **Keep tests green and add tests** for any backend behaviour you change (`backend/tests/`).

## Style

- UI copy: sentence case, plain words, active voice, no emoji, no all-caps labels. Buttons say what happens ("Offer to Ananya", "Scan with Scout").
- Frontend: React function components, no new dependencies without a clear need, colours only from the CSS tokens in `styles.css`.
- Backend: pydantic v2 models in `models.py`; keep agent flows in `agents.py`; emit a Mission control event (`Emitter`) for every visible step.
- Commits: small, descriptive, tests and builds passing. Never commit `.env`, keys or service-account files.

## Live mode status

Live and deployed: https://kintsugi-ai-builder-cup-2026.web.app (project `kintsugi-ai-builder-cup-2026`, Cloud Run `kintsugi-api`, Firestore, Cloud Storage, Maps). Every Gemini call works live (`python -m scripts.smoke_live`). Locally, run the backend with `GRPC_DNS_RESOLVER=native` when using Firestore or live mode. When a live call fails, fix it in `app/llm/gemini.py` (or the store/maps module), keep the mock behaviour identical, and add an offline test with a fake client. Deploys restart the server and interrupt running jobs: avoid deploying while judges are using the app. Job results are saved in Firestore, so keep them under 1 MB (store images in Cloud Storage and reference them by id). Run the tests with `set -o pipefail` when piping their output, so a failure stops a deploy. Judge mode must only ever clear its own sample data (`agents.clear_demo_data`), never call `store.reset()` on a shared database.
