# Next steps

Status on Sun 18 Oct 2026: the app is live in Gemini mode at **https://kintsugi-ai-builder-cup-2026.web.app** (Cloud Run `kintsugi-api` + Firebase Hosting, project `kintsugi-ai-builder-cup-2026`, Firestore, Cloud Storage, Maps). Everything up to PR #1 is merged into `main`. 76 backend tests pass. What's left needs people: the video (script in `docs/video/script.md`), the deck, checks on a real phone, and optional real-world data.

Deadline: submit by Sun 18 Oct 2026 (confirm the exact time and time zone on aibuildercup.com).

Keys go in `.env` files (git-ignored), never in the repo.

## What's built

| Area | Built |
|---|---|
| Home | Talk-first: "Moving, renovating or demolishing? Don't throw it out." Two modes (I have / I need something), each led by a big mic. A scan shows live under the mic (steps ticking off, a timer, what Gemini is doing, the agents' messages), then a Done card with the items to tap, then any buyer offers. Tapping Kintsugi in the top bar goes Home |
| Oracle | Reads notices in any language (More options in Scan), puts future supply and demand on the map |
| Scout | Video, photos and voice notes in any language; focuses on what's being offered; ledger materials and realistic weights; tap test; hazards; evidence photos with faces blurred; take-apart steps in the owner's language; uploads compressed in the browser |
| Ladder | Reuse, repair (only if it pays), upcycle, harvest parts, recycle, compost or biogas (organic), recover energy, safe disposal; per component; hazards never reused; enforced in code |
| Takers | Buyers, dealers, repairers, upcyclers, recyclers, government (municipal dry-waste centres, authorised e-waste points), compost and biogas units, energy recovery, licensed hazard handlers; real ones from Google Places in live mode; "Who can take it, nearest first" on every item; map as a list |
| Journey | Every item opens with what a thing like it can become (Gemini lists the possible next lives; code keeps them honest and marks the rules' choice as best), then its journey as a trail of seven stops with pictures, the item travelling the path; where each part goes, with what to do yourself before anything is burned or landfilled (`frontend/src/beforeLandfill.ts`, written in code by material); "Who did each step" lists the agent and model behind each stage |
| Reports | Impact report as a PDF (yours or everyone's) and every certificate as a PDF in English, Hindi or Kannada (fpdf2, bundled Noto fonts merged into KintsugiSans) |
| Standing | Each account earns a circular standing (Circular starter, contributor, champion) from settled hand-overs, sales and pickups, with a downloadable certificate |
| Languages | Kintsugi answers in English by default; the profile can choose Hindi, Kannada, Tamil, Bahasa Indonesia, Bahasa Melayu, Thai, Vietnamese, Filipino or Japanese, or "the language I speak to it". People can speak any language. Gemini voices are cached in Cloud Storage (`app/speech_cache.py`) |
| Market | Seller agent over A2A, buyer agent with a private cap, bilingual turns with Listen (Gemini TTS); one-tap offer; Autopilot: sellers let their agent sell within a private lowest price, buyers save standing requests and can approve automatically within a private highest price; neighbourhood pickup bundles; sandbox settlement shaped like AP2 |
| Live market | Sample buyers (a café, a housing NGO, a dealer) keep standing requests; when anyone lists something they want, the buyer's agent opens a negotiation with the seller's agent at once, live in Handovers. Nothing is sold until the seller accepts (unless they turned on Autopilot); the buyer's agent then approves within its private limit. Things with no resale value go to free hand-overs instead. `LIVE_MARKET=true` on the deployed API |
| People | Profiles for the sample personas: items, deals, standing requests, kg listed, CO2e that can be avoided and CO2e recorded, money earned or spent |
| Ledger | The Ledger tab is a live page: running totals, a paginated live feed of every listing, negotiation, hand-over, sale and pickup with "How it's counted" (kg × factor × share), breakdowns by next life and material, PDF reports and certificates (`/api/ledger/live`, `app/live_ledger.py`). Hallmarked certificates in English, Hindi and Kannada |
| Demo | Run demo replays a recorded real run (`/api/demo/recording`) on each viewer's screen, from chapter 1, as a full-screen story: seven chapters on a trail, the problem each solves, Gemini at work, the agents' live steps, where to try it, and a full-circle recap. Paced by its narration (Gemini TTS, cached in English and Hindi), with language, pause, previous/next and stop. A real run happens only when no recording exists, one at a time across servers (a lock in the store); it clears only its own sample data |
| Hand-overs | Hand it over completes the journey without money and records the impact at once (the endpoint answers with the kg and CO2e); a celebration opens instantly with what was saved, the certificate and the person's standing. Handovers lists every connection: waiting for you, under way, done, still to go |
| Cities | Sample data in Singapore, Tokyo, Jakarta, Bangkok, Manila, Kuala Lumpur, Ho Chi Minh City and Sydney besides Bengaluru (`app/demo/cities.py`, `SAMPLE_CITIES=true`), invented takers in the local language, routed by the real rules; a city picker on the map and Home; every reload starts in Bengaluru; "Near me" uses the person's location |
| Map | Pins only (things listed, takers, coming up, you) with a map key and plain hover text; connections are listed in Handovers |
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
