# Kintsugi

**Google Maps for the circular economy.** Point your phone at anything, and AI agents find its best next life.

Kintsugi is a living map of every reusable thing, part and material in a city, run by five Gemini agents. Film a broken chair or a whole building: Scout identifies each item and breaks it into parts and materials, the next-life ladder picks the best destination (reuse, repair, upcycle, harvest parts, recycle, recover energy, safe disposal), market agents negotiate the deal in each person's own language, and the ledger records the kilograms, CO2 and money saved.

Entry for the AI Builder Cup, Sustainability & Social Impact track. The full design is in [docs/implementation.md](docs/implementation.md).

**Try it live: https://kintsugi-ai-builder-cup-2026.web.app** (press **Run demo** for the narrated story)

**Watch the 3-minute demo: https://www.youtube.com/watch?v=DXN9g5Fb7hI**

[![Kintsugi: Scout lists every part it saw, buyer and seller agents negotiate over A2A, and the hand-over is counted in the ledger. Built with Gemini 2.5 Pro, 2.5 Flash, Flash Image, TTS and Embedding.](docs/hero.png)](https://www.youtube.com/watch?v=DXN9g5Fb7hI)

## Where things stand

Live on Google Cloud at https://kintsugi-ai-builder-cup-2026.web.app: every Gemini call runs live on Vertex AI, with Firestore, Cloud Storage and Google Maps behind it. 78 backend tests pass, and the app still runs fully offline in **mock mode** (sample data, no Google account needed).

| Part | Status |
|---|---|
| Five agents, the narrated judging demo, Mission control | Live |
| Next-life ladder, hazards, per-part routing, the item's journey | Live, tested |
| People in the loop: confirm or correct items, private lowest price, accept or decline offers, approval before anything is sold | Live, tested |
| Live market: buyers' agents open negotiations by themselves; Start a deal from Handovers | Live, tested |
| Voice in any language, spoken replies (Gemini TTS), English by default | Live |
| Evidence photos with face blur, take-apart steps in the owner's language | Live, tested |
| Seller agent over A2A (agent card + JSON-RPC), buyer agent with a private cap | Live, tested |
| Live ledger, PDF reports, certificates in English, Hindi and Kannada | Live, tested. Emission factors from the UK Government GHG Conversion Factors 2026 (Open Government Licence) |
| Sample cities across Asia-Pacific (Bengaluru, Singapore, Tokyo, Jakarta, Bangkok and more) | Live |
| Web app (installable PWA) and Android app (Capacitor) | Web live; Android builds from the same screens |
| AP2 settlement | Sandbox record shaped like AP2 mandates; no money moves |

**What to do next is in [NEXT_STEPS.md](NEXT_STEPS.md)**, ordered and with "done when" checks.

## Run it locally (mock mode)

Needs Python 3.11+ and Node 18+.

```bash
# API
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # MOCK_MODE=true by default
uvicorn app.main:app --reload --port 8080

# Web app (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173, /api is proxied to :8080
```

Open the app and press **Run demo** for the narrated story, or film something with **Scan with Scout**. Handovers shows the agents' negotiations, and Ledger shows what was saved.

Tests: `cd backend && pytest -q`

## Android app

The Android app lives in [`android/`](android/README.md). It runs the same screens as the web app inside a native shell with camera, microphone and location permissions, so the team polishes one set of screens. Quick start: `cd frontend && npm install && CAP_SERVER_URL=https://<project>.web.app npm run android:sync && npm run android:open`, then press Run in Android Studio.

Judges will use the web link, which is also installable from Chrome ("Add to Home screen"). The Android app is for filming Scout walkthroughs and showing the deal room on a phone in the demo video.

## Set up your own deployment

1. **Google Cloud:** `PROJECT=<id> REGION=us-central1 ./infra/setup_gcp.sh` enables the APIs, creates Firestore with the vector index, the uploads bucket and IAM roles.
2. **Model IDs:** check the current Gemini model IDs in Vertex AI Model Garden and set `MODEL_*` in `backend/.env`. `gemini-embedding-2-preview` is the multimodal embedding model.
3. **Auth for local runs:** `gcloud auth application-default login`
4. **Smoke test every live call:** `cd backend && MOCK_MODE=false python -m scripts.smoke_live path/to/clip.mp4 path/to/notice.pdf` and fix whatever fails, one call at a time (the code is in `app/llm/gemini.py`).
5. **Switch on:** in `backend/.env` set `MOCK_MODE=false`, `STORE=firestore`, `GCS_BUCKET`, `MAPS_API_KEY`. In `frontend/.env.local` set `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP_ID`.
6. **Measure Scout:** label 30–50 clips in `backend/eval/labels.json` (see `labels.example.json`) and run `python -m eval.run_eval eval/labels.json`. Put the real numbers on a slide.
7. **Replace sample data:** real dealers via the Places API (automatic in live mode), the dealer you interview, your own footage, verified emission factors (`backend/data/emission_factors.json`) and scrap rates (`backend/data/scrap_rates.json`).

## Deploy

```bash
PROJECT=<id> REGION=us-central1 MAPS_API_KEY=<server key> ./infra/deploy_backend.sh   # Cloud Run
PROJECT=<id> ./infra/deploy_frontend.sh                                               # Firebase Hosting
```

Firebase Hosting rewrites `/api/**` to the Cloud Run service, so the app and the API share one origin. Cloud Run runs with one warm instance and CPU always allocated, so judge mode never hits a cold start and background agent jobs keep running. Test the deployed link in an incognito window on a phone before submitting.

## How it works

### Architecture

```mermaid
flowchart TB
  subgraph Client["Phone or laptop"]
    direction LR
    PWA["React web app (PWA)<br/>Home · Map · Handovers · Ledger"]
    APK["Android app (Capacitor)<br/>same screens"]
  end

  Hosting["Firebase Hosting<br/>the app, and rewrites /api/** and /a2a/** to Cloud Run"]

  subgraph Run["Cloud Run: kintsugi-api (FastAPI)"]
    direction LR
    Agents["agents.py<br/>Oracle · Scout · Architect · Market · Ledger"]
    Rules["Rules in code<br/>next-life ladder · price guardrails"]
    A2A["Seller agent over A2A<br/>agent card + JSON-RPC"]
    Out["Jobs and live events<br/>PDF reports and certificates"]
  end

  subgraph Vertex["Vertex AI Gemini"]
    direction LR
    Pro["2.5 Pro<br/>video, voice, notices, design"]
    Flash["2.5 Flash<br/>prices, explain, translate, negotiate"]
    Image["2.5 Flash Image<br/>design renders"]
    TTS["2.5 Flash TTS<br/>spoken replies"]
    Embed["Embedding 2<br/>search, dedup, matching"]
  end

  subgraph Data["Google Cloud data and maps"]
    direction LR
    FS[("Firestore<br/>items · deals · jobs · ledger<br/>vector index")]
    GCS[("Cloud Storage<br/>uploads · blurred evidence<br/>cached voices")]
    Maps["Google Maps Platform<br/>Maps JS · Places · Geocoding"]
  end

  Client --> Hosting --> Run
  Agents --- Rules
  Agents --- A2A
  Agents --- Out
  Run --> Vertex
  Run --> Data
  Client -. map tiles .-> Maps
```

### Scan flow: from a video to a next life

```mermaid
sequenceDiagram
  autonumber
  actor Owner
  participant App as Web app
  participant API as Cloud Run API
  participant Pro as Gemini 2.5 Pro
  participant Flash as Gemini 2.5 Flash
  participant Emb as Gemini Embedding 2
  participant Maps as Places API
  participant Rules as Ladder and ledger (code)
  participant DB as Firestore and Storage

  Owner->>App: Films things, talks in any language
  App->>API: POST /api/scan (video, photos, voice)
  API-->>App: Job id, and the scan shows live under the mic
  API->>Pro: Watch the video, hear the voice
  Pro-->>API: Items, condition, parts, materials, hazards
  API->>Emb: Embed each item
  Emb-->>API: Vectors, so repeated sightings merge
  API->>Flash: Price each item, with sources
  API->>Maps: Nearby recyclers, repairers, buyers
  API->>Rules: Pick each part's next life and taker, count CO2
  API->>DB: Evidence frames, faces blurred first
  API->>Flash: Take-apart steps in the owner's language
  API->>DB: Save item passports
  API-->>App: Done: the items to tap
  API->>API: Market job: buyers' agents look for matches
  API-->>App: Offers appear in Handovers
```

### The next-life ladder (code decides, Gemini explains)

```mermaid
flowchart TD
  Start(["Item from Scout"]) --> Hazard{"Suspected hazard?"}
  Hazard -- yes --> Safe["Safe disposal<br/>licensed handler,<br/>professional testing required"]
  Hazard -- no --> Cond{"Condition A or B<br/>and a taker nearby<br/>wants it as it is?"}
  Cond -- yes --> Reuse["Reuse"]
  Cond -- no --> Rep{"Repairer nearby and<br/>repair costs less<br/>than its value?"}
  Rep -- yes --> Repair["Repair"]
  Rep -- no --> Up{"Upcycler nearby<br/>takes this item?"}
  Up -- yes --> Upcycle["Upcycle"]
  Up -- no --> Apart["Take it apart:<br/>route each part"]

  Apart --> P1{"Someone takes<br/>the part as a part?"}
  P1 -- yes --> Harvest["Harvest parts"]
  P1 -- no --> P2{"Recycler takes<br/>its material?"}
  P2 -- yes --> Recycle["Recycle"]
  P2 -- no --> P3{"Organic and a<br/>compost or biogas unit?"}
  P3 -- yes --> Compost["Compost or biogas"]
  P3 -- no --> P4{"Energy facility<br/>takes it?"}
  P4 -- yes --> Energy["Recover energy"]
  P4 -- no --> Disposal["Safe disposal"]
```

Only takers within the search radius count, and the nearest one wins at each step. Gemini then explains the decision in the owner's language, starting with what the thing can become.

### Agent-to-agent deal

```mermaid
sequenceDiagram
  autonumber
  actor Buyer
  participant BA as Buyer agent<br/>(private budget cap)
  participant SA as Seller agent over A2A<br/>(private floor price)
  participant Flash as Gemini 2.5 Flash
  actor Seller
  participant Ledger

  Note over BA,SA: Started by a buyer's standing request, Start a deal, or Autopilot
  BA->>SA: Fetch the agent card, open a negotiation (JSON-RPC)
  loop Up to 12 rounds
    SA->>Flash: Write the offer in the seller's and buyer's languages
    SA-->>BA: Offer or counter (never below the floor)
    BA->>Flash: Write the reply in both languages
    BA-->>SA: Counter or accept (never above the cap)
  end
  Note over BA,SA: Guardrails in code clamp any price past a limit,<br/>and the note never says the limit
  SA-->>Seller: Agreed price: accept or decline (when a buyer's agent started it)
  Seller->>SA: Accept
  BA-->>Buyer: Approve? (or auto-approve within the cap)
  Buyer->>BA: Approve
  BA->>Ledger: Sandbox settlement shaped like AP2 (no money moves)
  Ledger-->>Buyer: CO2 avoided, kg kept, certificate
  Ledger-->>Seller: Certificate and standing
```

### Deal and item states

```mermaid
stateDiagram-v2
  direction LR
  state "Deal" as D {
    [*] --> negotiating
    negotiating --> agreed: limits overlap
    negotiating --> no_deal: limits don't overlap
    agreed --> no_deal: seller declines
    agreed --> approved: seller accepted, buyer approves
    approved --> settled: sandbox settlement, ledger entries
    [*] --> settled: free hand-over
  }
  state "Item" as I {
    [*] --> available
    available --> in_deal: a negotiation starts
    in_deal --> available: no deal
    in_deal --> sold: deal settled
    available --> routed: handed over for free
  }
```

### Data model

```mermaid
erDiagram
  PARTICIPANT ||--o{ SITE : owns
  SITE ||--o{ ITEM : "has"
  PARTICIPANT ||--o{ ITEM : sells
  ITEM ||--|{ COMPONENT : "made of"
  PARTICIPANT ||--o{ STANDING_REQUEST : "looks for"
  DEAL }o--|{ ITEM : covers
  PARTICIPANT ||--o{ DEAL : "buys or sells in"
  DEAL ||--o{ NEGOTIATION_TURN : transcript
  DEAL ||--o| SETTLEMENT : "settled by"
  ITEM ||--o{ LEDGER_ENTRY : "counted in"

  PARTICIPANT {
    string role "homeowner, dealer, repairer, recycler..."
    string language
    geo location
    float floor_price_inr "private to the seller agent"
    float budget_cap_inr "private to the buyer agent"
  }
  ITEM {
    string type
    string condition "A to D"
    string next_life "a ladder rung"
    float value_min_inr
    float value_max_inr
    string status "available, in_deal, sold, routed"
    bool verified "a person confirmed it"
    vector embedding
  }
  COMPONENT {
    string material
    float est_weight_kg
    string next_life
  }
  DEAL {
    string kind "sale or handover"
    string status
    float final_price_inr
    bool seller_accepted
  }
  NEGOTIATION_TURN {
    string speaker "seller or buyer"
    string action "offer, counter, final, accept"
    float price_inr
    json messages "one per language"
    bool guardrail_applied
  }
  LEDGER_ENTRY {
    string material
    string rung
    float mass_kg
    float co2_avoided_kg
    float factor_kg_per_kg
    string factor_source
  }
```

### How CO2 is counted

```mermaid
flowchart LR
  M["Mass of each part (kg)"] --> X(("×"))
  F["Emission factor of its material<br/>(UK DESNZ 2026, kg CO2e per kg)"] --> X
  R["Credit for the next life<br/>(reuse avoids more than recycling)"] --> X
  P["Replacement share: 60% for reuse,<br/>repair, upcycle and parts<br/>(Farrant, Olsen and Wangel 2010)"] --> X
  X --> C["CO2e avoided, recorded only<br/>when the hand-over or sale is done"]
```

### Code map

| File | What it does |
|---|---|
| `backend/app/agents.py` | The five agents and the flows that connect them, including judge mode |
| `backend/app/ladder.py` | Next-life decision rules (the model explains; code decides) |
| `backend/app/negotiation.py` | Concession strategy, guardrails, bilingual turns, sandbox settlement |
| `backend/app/ledger.py`, `materials.py` | CO2 and value accounting with sources; multilingual material aliases |
| `backend/app/bundler.py`, `dedup.py` | Neighbourhood pickup bundles; merging repeat sightings |
| `backend/app/llm/` | `gemini.py` (live), `mock.py` (offline), prompts and JSON schemas |
| `backend/app/store/` | In-memory and Firestore stores behind one interface |
| `backend/kintsugi_adk/agent.py` | The same tools as an ADK coordinator with architect, market and ledger sub-agents |
| `frontend/src/` | React app: `MapView` (Google Maps or schematic), `DealRoom`, `MissionControl`, `Passport` |
| `frontend/capacitor.config.ts`, `android/` | Android app (Capacitor) built from the same screens |

Guardrails worth pointing out to judges: hazards are never routed to reuse; prices can't cross the seller's floor or the buyer's cap (enforced in code and covered by a test with a deliberately rogue proposer); nothing settles without the buyer's tap; private limits never reach the browser; every CO2 figure links to its factor and source.

## Next steps

See [NEXT_STEPS.md](NEXT_STEPS.md).
