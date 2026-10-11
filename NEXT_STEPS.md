# Next steps

Everything in the plan that doesn't need Google Cloud credentials is built and tested (29 backend tests, browser walkthrough of every screen). What's left needs API keys, real-world data, a phone, or people. Tasks are ordered; each says where to work and when it's done.

Deadline: submit by Sun 18 Oct 2026 (confirm the exact time and time zone on aibuildercup.com). Feature freeze: Sat 17 Oct, 12:00.

## Handing a task to Claude

Open the repo in Claude Code and say, for example:

> Read CLAUDE.md and NEXT_STEPS.md, then do task A2. Run the backend tests and the frontend build before committing.

Give Claude the values it can't know (project ID, keys go in `.env` files, never in chat if you can avoid it).

## What's done

| Area | Built |
|---|---|
| Oracle | Reads notices in any language (upload in Scan), dedupes, puts future supply and demand on the map |
| Scout | Video, photos and voice notes; narration and typed or spoken notes in any language; tap test; hazards; dedup; confidence and "verify" flags; evidence photos with faces blurred; take-apart steps in the owner's language |
| Ladder | Reuse, repair (only if it pays), upcycle, harvest parts, recycle, recover energy, safe disposal; per component; hazards never reused |
| People in the loop | Confirm or correct an item; seller's private lowest price (typed or spoken); one-tap offer to the ladder's buyer; buyer approves before settlement |
| Architect | Cross-language search by text, voice or photo; design from a brief (typed or spoken) and an optional inspiration photo |
| Market | Seller agent over A2A (agent card at `/a2a/seller/.well-known/agent-card.json`); buyer agent with private cap; bilingual turns with Listen; neighbourhood pickup bundles (automatic after home scans); sandbox settlement shaped like AP2 |
| Ledger | Per-material CO2 and value with sources; city totals; certificate in English, Hindi and Kannada |
| Demo | Judge mode (whole story in about a minute, skippable), Mission control timeline |
| Apps | Web app (installable PWA), Android app (Capacitor) with camera, microphone, location and text-to-speech |
| Deploy | `infra/setup_gcp.sh`, `infra/deploy_backend.sh`, `infra/deploy_frontend.sh`, Firebase rewrites for `/api` and `/a2a` |

## A. Needs Google Cloud or API keys

### A1. Set up Google Cloud (Mon 12 Oct, AI lead)
- Run `PROJECT=<id> REGION=us-central1 ./infra/setup_gcp.sh`, then `gcloud auth application-default login`.
- Create the two Maps keys and a Map ID as the script's closing message says.
- Done when: `gcloud firestore indexes composite list` shows the `items.embedding` vector index and the `events` index, and the bucket has the 1-day lifecycle rule on `uploads/`.

### A2. Make every live Gemini call work (Mon 12 Oct, AI lead)
- In `backend/.env`: `MOCK_MODE=false`, `GCP_PROJECT`, `GCP_LOCATION`, and current `MODEL_*` IDs from Vertex AI Model Garden.
- Run `python -m scripts.smoke_live clip.mp4 notice.pdf voice_note.m4a` and fix failures one at a time in `app/llm/gemini.py`. It checks embeddings, pricing with Search grounding, negotiation wording, design, render, take-apart steps, Scout on video, Oracle on a PDF, transcription and a voice-note listing.
- Likely issues: model IDs; whether the chosen model accepts `response_json_schema` (fallback: `response_schema` or JSON in the prompt); Search grounding replies that aren't clean JSON (`_json_from_text` handles prose, extend it if needed); the Embedding 2 call shape for images and `output_dimensionality`; the image model's `response_modalities`.
- Done when: every smoke step prints OK, and a real 30-second walkthrough produces a sensible inventory in the app.

### A3. Scout quality on your footage (Tue 13 Oct checkpoint, AI lead + Story lead)
- Label 30–50 clips in `backend/eval/labels.json` (see `labels.example.json`), run `python -m eval.run_eval eval/labels.json`, tune `SCOUT_SYSTEM` in `prompts.py`.
- If inventories are still poor: shorter clips, fewer item classes, the A4-sheet scale trick.
- Done when: `eval/results.md` has numbers you're willing to put on a slide.

### A4. Firestore and Cloud Storage (Wed 14 Oct, AI lead)
- Set `STORE=firestore` and `GCS_BUCKET`. Run judge mode, a real scan, a search and a deal.
- Watch for: vector search (`nearest_items`), the events query index, embedding dimension matching the index (`EMBEDDING_DIM`), evidence images stored under `evidence/` in the bucket.
- Judge mode calls `store.reset()`, which deletes the collections: only use a demo database.
- Done when: the whole flow works with `STORE=firestore` and survives an API restart.

### A5. Google Maps in the app (Wed 14 Oct, App lead)
- `frontend/.env.local`: `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID`. Backend `MAPS_API_KEY` turns on Places discovery of real dealers, repairers, upcyclers and recyclers near each scan (`app/maps.py`).
- Check pins, the gold deal seams (Polyline) and that real places appear as takers.
- Optional: a map style in the brand palette (indigo, porcelain, gold).
- Done when: the real map replaces the schematic one and a live scan shows real nearby takers.

### A6. Deploy and test like a judge (Fri 16 Oct, App lead)
- `./infra/deploy_backend.sh` (sets `PUBLIC_BASE_URL` for the A2A agent card) and `./infra/deploy_frontend.sh`.
- In an incognito window on a phone: Run demo, Skip, Deal, Impact, certificate; the agent card at `https://<project>.web.app/a2a/seller/.well-known/agent-card.json`.
- Done when: the link works on a phone and a laptop with no login, and Cloud Run keeps one warm instance.

### A7. Real-time voice while filming, Gemini Live API (stretch, Thu 15 Oct)
- Today voice is record-then-transcribe (`/api/transcribe`). The plan's "Scout talks while you film" needs the Gemini Live API over a WebSocket. Only do this if A2–A6 are done.

### A8. AP2 for real (optional)
- Settlement is a sandbox record shaped like AP2's intent, cart and payment mandates (`negotiation.sandbox_settlement`). If time allows, swap in the AP2 reference implementation in test mode; keep the "SANDBOX" label either way.

### A9. Seller agent as its own service (optional)
- Deploy the API a second time as `kintsugi-seller` and set `A2A_SELLER_URL` on the main service. A2A sessions are in memory, so give the seller service `--max-instances 1` or session affinity.

## B. No keys needed

### B1. First Android build (Mon 12 Oct, App lead)
- Follow `android/README.md`. Test on a real phone: filming opens the camera, "Record a voice note" asks for the microphone, "Use my location" asks for location, Listen speaks Hindi.
- Done when: an APK is installed on a phone and the demo runs in it.

### B2. Native-speaker check (any day, Story lead)
- Hindi and Kannada strings were written without review: `backend/app/certificate.py`, `backend/app/demo/fixtures.py` (negotiation templates, take-apart steps, sample notices).
- Done when: a native speaker has read each one.

### B3. Real data instead of samples (Tue–Wed, Story lead)
- Verify every factor in `backend/data/emission_factors.json` against the ICE version you cite and update `source`.
- Put the interviewed dealer's rates in `backend/data/scrap_rates.json`.
- Film a real home item and a real building; record one dealer quote for the deck.

### B4. Polish (Thu–Fri, App lead)
- Overlapping pins at one location (cluster or offset them).
- Show a short "what just happened" summary at the end of judge mode.
- Check every screen at 360 px wide and with large system fonts.

## C. Demo and submission (Fri–Sun)
- Video: shot list in `docs/implementation.md` (Demo plan). The hero moment is the deal room: Hindi on one phone, English on the other.
- Deck: 10 slides (also in the implementation doc); include the eval numbers and the architecture.
- Submission checklist in the implementation doc. Re-read the official rules (originality, AI-assisted code, eligibility).

## Known limits to say out loud
- Settlement is sandboxed; no money moves.
- Hindi and Kannada offline templates exist; other languages need live mode.
- Face blurring uses OpenCV's classic detector: good for frontal faces, can miss side profiles.
- Home locations are coarsened to about 500 m, not hidden.
