# Next steps

Status on Sat 17 Oct 2026: the app is live in Gemini mode at **https://kintsugi-ai-builder-cup-2026.web.app** (Cloud Run `kintsugi-api` + Firebase Hosting, project `kintsugi-ai-builder-cup-2026`, Firestore, Cloud Storage, Maps). 62 backend tests pass; every screen was checked on an Android emulator, including 360 px wide with large system fonts. What's left needs people: the video, the deck, and optional real-world data.

Deadline: submit by Sun 18 Oct 2026 (confirm the exact time and time zone on aibuildercup.com).

## Handing a task to Claude

Open the repo in Claude Code and say, for example:

> Read CLAUDE.md and NEXT_STEPS.md, then do the next open task. Run the backend tests and the frontend build before committing.

Keys go in `.env` files (git-ignored), never in chat if you can avoid it.

## What's built

| Area | Built |
|---|---|
| Home | Talk-first: "Moving, renovating or demolishing? Don't throw it out." Two modes (I have / I need something), each led by a big mic; moving, renovating and demolishing set up the scan; Kintsugi answers out loud in the language you spoke (Gemini translation and TTS), with a voice switch |
| Oracle | Reads notices in any language (More options in Scan), puts future supply and demand on the map |
| Scout | Video, photos and voice notes in any language; focuses on what's being offered; ledger materials and realistic weights; tap test; hazards; evidence photos with faces blurred; take-apart steps in the owner's language; uploads compressed in the browser |
| Ladder | Reuse, repair (only if it pays), upcycle, harvest parts, recycle, compost or biogas (organic), recover energy, safe disposal; per component; hazards never reused; enforced in code |
| Takers | Buyers, dealers, repairers, upcyclers, recyclers, government (municipal dry-waste centres, authorised e-waste points), compost and biogas units, energy recovery, licensed hazard handlers; real ones from Google Places in live mode; "Who can take it, nearest first" on every item; map as a list |
| Journey | Every item opens with what a thing like it can become (Gemini lists the possible next lives, code keeps them honest and marks the rules' choice as best), then its second life as a seven-stage story (scanned to impact recorded) with who did each stage and what happens next; a person's own scan, hand-over or deal can be followed live as the same stages |
| Reports | Impact report as a PDF (yours or everyone's) and every certificate as a PDF in English, Hindi or Kannada (fpdf2, bundled Noto fonts merged into KintsugiSans) |
| Standing | Each account earns a circular standing (Circular starter, contributor, champion) from settled hand-overs, sales and pickups, with a downloadable certificate |
| Languages | English, Hindi, Kannada, Tamil, Bahasa Indonesia, Bahasa Melayu, Thai, Vietnamese, Filipino and Japanese for explanations, Ask Kintsugi and spoken replies; a language setting in the profile; results are read aloud without tapping Listen |
| Market | Seller agent over A2A, buyer agent with a private cap, bilingual turns with Listen (Gemini TTS); one-tap offer; Autopilot: sellers let their agent sell within a private lowest price, buyers save standing requests and can approve automatically within a private highest price; neighbourhood pickup bundles; sandbox settlement shaped like AP2 |
| People | Profiles for the sample personas: items, deals, standing requests, kg listed, CO2e that can be avoided and CO2e recorded, money earned or spent |
| Ledger | Per-material CO2e and value with sources; potential and recorded impact; hallmarked A4 certificate with a gold seal, in English, Hindi and Kannada |
| Demo | Run demo opens a seven-chapter story with plain captions, the Gemini models at work, progress and a recap; skippable; it clears only its own sample data, so people's data survives; one demo at a time |
| Apps | Installable web app; Android app (Capacitor), debug APK built against the live site |
| Deploy | `infra/setup_gcp.sh`, `infra/deploy_backend.sh` (one warm instance), `infra/deploy_frontend.sh` |

## Done

- A1 Google Cloud set up (APIs, Firestore with vector and events indexes, bucket deleting raw uploads after 30 days, set for the judging period, IAM)
- A2 Live Gemini: every smoke step passes; model IDs current (2.5 Pro and Flash, Flash Image, Flash TTS, Embedding 2). Fixed on the way: grounded pricing (timeout, retry, stricter prompt), embeddings (one call per text: Embedding 2 folds a list into one vector), judge mode in live mode
- A4 Firestore and Cloud Storage: judge mode, scans, search, deals and Autopilot work with `STORE=firestore`
- A5 Maps: browser key (Maps JavaScript, restricted to the site) and server key (Places + Geocoding); real nearby takers appear after live scans. Uses `DEMO_MAP_ID`
- A6 Deployed; Cloud Run keeps one warm instance
- B1 Android: builds with Gradle 8.14.3 and JDK 21; `android/app/build/outputs/apk/debug/app-debug.apk` opens the live site
- B4 Polish: overlapping pins fan out; judge mode ends with a "what just happened" recap; checked at 360 px with large fonts

Decided not to do: A7 Gemini Live API, A8 real AP2, A9 seller agent as its own service.

## Open (people)

### C. Demo and submission (today)
- Video, 3 minutes, English (subtitle any Hindi). Suggested shots: Home's opening line; a real scan on your phone with Hindi narration and the spoken answer; the item journey and "who can take it"; Run demo's story through the deal room (Hindi on one phone, English on the other); Autopilot settling a deal by itself; the certificate.
- Deck (PDF): problem (homes and demolition sites with no option but to throw away), how it works, Gemini usage per agent, architecture, impact numbers, what's next.
- Submission: live link above, video link, deck PDF, category Sustainability & Social Impact. Re-read the official rules.
- Optional: share the APK as a download link.

### B2. Native-speaker check (optional)
Hindi and Kannada strings written without review: `backend/app/certificate.py`, `backend/app/demo/fixtures.py`. Live translations come from Gemini.

### B3. Real data (optional; sample data is labelled)
- Emission factors are done: `backend/data/emission_factors.json` is generated from the UK Government GHG Conversion Factors 2026 (DESNZ, flat file v1.2, Open Government Licence v3.0), with the government row behind each value in `basis`. ICE was not used: its v5.0 Educational terms forbid use in software or carbon calculations.
- `backend/data/scrap_rates.json` holds sample Bengaluru rates.

### A3. Scout accuracy numbers (optional)
Label 10 to 30 clips in `backend/eval/labels.json` and run `python -m eval.run_eval eval/labels.json` for numbers on a slide.

## Running and deploying

- Local live mode: in `backend/.env` set `MOCK_MODE=false`; start with `GRPC_DNS_RESOLVER=native uvicorn app.main:app --port 8080` (the Firestore client hangs on some networks without it).
- Deploy: `MK=$(grep '^MAPS_API_KEY=' backend/.env | cut -d= -f2-); PROJECT=kintsugi-ai-builder-cup-2026 MOCK_MODE=false MAPS_API_KEY="$MK" ./infra/deploy_backend.sh` and `PROJECT=kintsugi-ai-builder-cup-2026 ./infra/deploy_frontend.sh`.
- After judging: shorten raw-upload storage again with `UPLOAD_DAYS=1` (or edit the bucket's lifecycle rule), and lower cost with `gcloud run services update kintsugi-api --region us-central1 --min-instances 0`.

## Known limits to say out loud
- Settlement is sandboxed; no money moves.
- Sample data (people, notices, demo items, emission factors, scrap rates) is labelled as such.
- Face blurring uses OpenCV's classic detector: good for frontal faces, can miss side profiles.
- Home locations are coarsened to about 500 m, not hidden.
- There are no accounts: you pick a sample persona in the profile.
