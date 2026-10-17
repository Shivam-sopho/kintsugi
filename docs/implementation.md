# Kintsugi: Implementation Document

**Google Maps for the circular economy.**
*Point your phone at anything, and AI agents find its best next life.*

| Item | Detail |
|---|---|
| **Event** | AI Builder Cup (aibuildercup.com) |
| **Track** | Sustainability & Social Impact |
| **Team** | 3 members (Member A: AI lead · Member B: App lead · Member C: Story lead) |
| **Build window** | Sun 11 Oct → Sun 18 Oct 2026 (submission deadline) |
| **Status** | Idea locked · Implementation starting |
| **Goal** | Top 50 → Singapore finals → win |

---

## Summary

We are building Kintsugi for the Sustainability & Social Impact track: a team of multilingual Gemini agents that finds the best next life for any object, from a broken chair to a whole building, and closes the deal. It is aimed at the 40% technical criterion through a five-agent system on Google's newest models and protocols, and at impact and originality through an Asia-first circular economy that today's resale apps and European reporting tools do not cover. The plan below ships every layer in its thinnest working form by 18 October, with real footage, measured accuracy and a judge mode.

The world uses 106 billion tonnes of materials a year, and only 6.9% of them come from secondary (reused or recycled) sources. Things are not wasted because they are useless. They are wasted because nobody knows what they are, what they are worth, or who needs them. That is an information problem, and AI that can see, understand and act is built to solve it.

**Kintsugi** is a living map of every reusable thing, part and material, run by a team of multilingual AI agents. You film anything (a broken chair, a room, a whole building) and Kintsugi:

1. **Sees** it: identifies each item and breaks it down into parts and materials.
2. **Decides** its best next life on the circular ladder: reuse → repair → upcycle → harvest parts → recycle → recover energy → safe disposal.
3. **Acts**: finds the buyer, repairer, upcycler or recycler on the map, lets their agents negotiate in each person's own language, and bundles small items from neighbours into one pickup.
4. **Proves** the impact: a live ledger of tonnes diverted, CO2 avoided and money recovered.

The name comes from *kintsugi*, the Japanese art of repairing broken pottery with gold so it becomes more valuable than before.

---

## How we win: mapping to the judging criteria

| Criterion | Weight | What judges look for | How Kintsugi scores |
|---|---|---|---|
| Technical merit & Gen AI | 40% | Gemini doing the core work; agentic, multimodal, not a chatbot wrapper | Five cooperating agents (ADK), video + audio + document understanding, Gemini Embedding 2 cross-modal search, A2A agent negotiation, AP2 settlement, Search grounding, image generation. Mission control view makes depth visible. Measured accuracy (eval). |
| Problem alignment & impact | 25% | Real, painful, quantified problem; credible users | Planet-scale problem (6.9% circularity), Asia-first, informal reuse economy brought online. One real site scan + real dealer quote. Ledger shows tonnes / CO2 / money. |
| Innovation & originality | 25% | Not a generic idea; fresh angle | Not a resale app: routes *any* item, including true waste, down to material level. Agent-to-agent circular marketplace across languages. Predictive supply from permits. |
| UX & presentation | 10% | Simple, polished, demo-able | One map, two simple flows (Seller: film it · Buyer: find/design it), voice-first, one-tap approvals, judge mode. |

**Winning patterns from recent Google Cloud hackathons we are deliberately following:** multi-agent systems rather than single chatbots; agents that take actions rather than just answer; multimodal input; a polished demo with a clear "wow" moment and real-world impact.

---

## Problem statement

- Global material use has passed **106 billion tonnes a year**; only **6.9%** comes from secondary sources, down from 7.2% two years earlier (Circularity Gap Report 2025).
- The built environment accounts for roughly **40% of global carbon emissions**; reusing existing buildings and materials can offset emissions by up to **75%** (Autodesk Research).
- Pre-demolition audits are often carried out and then **"gather dust in a drawer"**: the scan exists but nobody acts on it (Saint-Gobain / Alcimed report).
- Reuse can already pay: in an Autodesk case study, a test section of intact drywall was worth **$121** if reused versus **$102** in disposal costs if dumped.
- In homes, low-value items (a ₹300 chair) are simply thrown away because listing, negotiating and arranging pickup is not worth the effort.

**Root cause:** waste is an information failure: no identity, no value, no destination, no transaction.

---

## Goals and non-goals

### Goals (for the hackathon submission)
1. A working, deployed prototype where every one of the five layers runs end to end, each in its thinnest working form.
2. A judge mode that runs a full scenario in under a minute with no login.
3. Real footage from at least one real home and one real building/office, plus one real dealer quote.
4. Measured accuracy of the Scout agent on our own labelled test clips.
5. A 3-minute video built around one hero moment.

### Non-goals (roadmap slide only)
- Real money movement (AP2 runs in sandbox/test mode only).
- Logistics/transport agent, live route optimisation.
- Offline mode, native mobile apps (we ship a mobile-friendly web app).
- Extra domains: factories, offices at scale, disaster zones.
- Hidden materials inside walls (we scope to visible, removable items).

---

## Users and personas

| Persona | Language (demo) | What they want | Kintsugi flow |
|---|---|---|---|
| **Homeowner** (e.g. someone with a broken chair) | English / Hindi | Get rid of it responsibly with no effort | Film → passport → best next life → bundled pickup |
| **Site engineer / demolition contractor** | English / Hindi | Reduce disposal cost, earn from salvage | Walkthrough video → site inventory → offers |
| **Scrap dealer (kabadiwala) / salvage yard** | Hindi (voice notes) | Steady supply, simple deals | Voice-note listings, agent negotiates for them |
| **Repairer / upcycler / recycler** | Local language | Parts and materials near them | Map search, pickup bundles |
| **Architect / café owner (buyer)** | English | Characterful, cheaper, low-carbon materials | Search by photo/voice/text, design from nearby stock |
| **Judge** | English | Understand and test in 60 seconds | Judge mode |

---

## Core concepts

### The next-life ladder
Kintsugi always climbs down this ladder and picks the highest feasible rung, per item and per component:

1. **Reuse:** someone wants it as it is.
2. **Repair:** fix it, then reuse it.
3. **Repurpose / upcycle:** turn it into something else.
4. **Harvest parts:** take it apart; send components where they are needed.
5. **Recycle:** separate raw materials (wood, metal, plastic, fabric, glass).
6. **Recover energy:** non-recyclable fractions to a proper facility.
7. **Safe disposal:** last resort, done responsibly (hazards flagged).

### Item passport
Every item gets a digital identity:
- Item type, estimated dimensions, quantity, condition grade (A/B/C/D) with confidence.
- Components and materials with estimated weights.
- Recommended next life per component, with reasoning.
- Estimated value range (with grounded price sources) and CO2 avoided (with emission-factor source).
- Evidence: timestamped video clip / photos; location; hazards.
- Embedding vector (Gemini Embedding 2) for cross-modal, cross-language search.

### The living map
One map is the whole product. Layers:
- **Future pins** (Oracle): buildings due for demolition, projects that will need materials.
- **Material pins** (Scout): scanned items and materials available now.
- **Destination pins**: repairers, upcyclers, recyclers, dealers, NGOs.
- **Deal lines** (Market agents): a line from seller to buyer when a deal closes.
- **City totals** (Ledger): live tonnes, CO2, money.

### Material decomposition
Scout breaks items into components and materials so even "true waste" gets destinations. Example, a broken chair: teak frame (4 kg) → furniture upcycler; steel screws (0.3 kg) → scrap metal; foam (1 kg) → waste facility; fabric → textile recycler. Ledger: "92% recovered by weight". (Figures illustrative; real values come from the model + emission-factor table.)

---

## Key user journeys

### J1: "One chair" (home)
1. User opens Kintsugi, taps **Scan**, films the chair for 10 s while saying (any language) "the leg is broken".
2. Scout returns a passport: item, condition D, components, materials, weights.
3. Ladder: reuse ✗ (condition), repair ✓ if a repairer within 3 km quotes < item value; else harvest parts / recycle.
4. Voice-guided take-apart steps (if user chooses to separate).
5. Bundler agent adds it to a pickup with neighbours' items; dealer's agent accepts.
6. Ledger updates; user gets a small impact card.

### J2: "One building" (site)
1. Site engineer films a 40–60 s walkthrough, narrating; optionally does tap tests on tiles.
2. Scout outputs a site inventory (deduplicated), hazards flagged (e.g. suspected asbestos sheets → "get professional testing"), values and CO2.
3. Pins appear on the map; offers are generated for matching buyers.

### J3: "Design from what exists" (buyer)
1. Café owner says: "cozy café, 40 m², ₹5 lakh, warm wood".
2. Architect queries the vector index for nearby matching stock, proposes a bill of reclaimed materials, renders a design image.
3. Buyer taps items → Market agents start negotiations.

### J4: The cross-language deal (hero moment)
1. Seller (Hindi-speaking dealer) has set a floor price by voice note.
2. Buyer (English-speaking architect) has a budget cap.
3. Their agents negotiate over A2A in structured messages; each human hears/reads updates in their own language.
4. Agreement → buyer taps **Approve** → AP2 sandbox settlement → deal line drawn on map → ledger ticks up.

### J5: Judge mode
One button on the landing page loads a preset scenario (pre-uploaded real footage), runs all five layers with mission control visible, and ends on the ledger. No login. Target < 60 s.

---

## System architecture

### High-level flow

```
[Phone web app]  --video/photo/voice-->  [Cloud Storage]
       |                                         |
       v                                         v
[API service · Cloud Run] ---> [Orchestrator (ADK)]
                                   |  |  |  |  |
                 +-----------------+  |  |  |  +----------------+
                 v                    v  |  v                   v
             [Oracle]            [Scout] | [Architect]       [Ledger]
                                         v
                              [Market agents: Seller / Buyer / Bundler]
                                   <-- A2A -->      --> AP2 (sandbox)
                 |                    |       |          |
                 v                    v       v          v
        [Firestore: sites, items, passports, listings, deals, ledger, predictions]
        [Firestore vector index: Gemini Embedding 2 vectors]
                 |
                 v
     [Map UI · Maps JavaScript API]  [Mission control]  [City dashboard]
```

### Components

| Component | Responsibility | Tech |
|---|---|---|
| Web app | Map, Scan, Passport, Find/Design, Deal room, Mission control, Ledger, Judge mode | Next.js or React + Vite on Firebase Hosting; Maps JavaScript API; mobile-first |
| API service | Upload handling, job creation, REST/WebSocket to UI | Cloud Run (Python FastAPI) |
| Orchestrator | Runs agent graph, passes state, streams events to mission control | Agent Development Kit (ADK, Python) |
| Agents | Oracle, Scout, Architect, Market (Seller/Buyer/Bundler), Ledger | Gemini on Vertex AI via ADK tools |
| Agent-to-agent | Seller and buyer agents as separate A2A services with Agent Cards | A2A protocol (separate Cloud Run services) |
| Payments | Settle approved deals (sandbox only) | AP2 (test credentials / mocked payment rail) |
| Storage | Raw media | Cloud Storage |
| Database | All entities + vector search | Firestore (Native) with vector fields |
| Search | Cross-modal, cross-language matching | Gemini Embedding 2 (`gemini-embedding-2-preview`) |
| Grounding | Current resale prices with sources | Gemini grounding with Google Search |
| Places | Repairers, recyclers, dealers near a pin | Google Maps Platform (Places API) |
| Voice | Real-time spoken guidance and voice input | Gemini Live API |
| Images | Design renders | Gemini image generation |
| Events | Agent progress streaming to UI | Firestore listeners or WebSocket from Cloud Run |

**Model choice:** use the best current Gemini Pro-tier model on Vertex AI for video understanding and negotiation reasoning; a Flash-tier model for fast, cheap steps (classification, translation, summaries). Confirm exact model IDs in Vertex AI Model Garden on Day 0. Keep a config flag to swap models and to fall back if a preview model misbehaves.

---

## Agent specifications

### Oracle (Predict)
- **Purpose:** show future supply (buildings due for demolition, renovations) and future demand (new projects) as map pins.
- **Inputs:** PDFs/scans of permits, tender notices, lease/closure notices, in local languages.
- **Process:** Gemini document understanding → extract {address, type, date, expected materials, confidence} → geocode → pin.
- **Outputs:** `predictions` documents; Future pins layer.
- **MVP:** 5–10 sample documents (clearly labelled as sample/synthetic in the UI and video), at least two non-English.
- **Stretch:** estimate likely material inventory by building type and age.

### Scout (See)
- **Purpose:** turn media into item passports.
- **Inputs:** video (≤ 60 s), photos, voice narration (any language), tap-test audio clips, optional reference object (A4 sheet) for scale.
- **Process:**
  1. Gemini video understanding with a strict JSON schema: items, timestamps, counts, condition, components, materials, estimated dimensions/weights, hazards, confidence.
  2. Fuse narration (transcribed/understood by Gemini) with visual findings.
  3. **Deduplicate** sightings: embed frame crops / item descriptions with Gemini Embedding 2; merge items above a similarity threshold within the same site.
  4. **Tap test:** classify knock audio as solid / hollow (indicative only, labelled as such).
  5. Ladder decision per item and component (rules + model reasoning; see Ladder decision logic).
- **Outputs:** `items`, `components`, `passports`; Material pins.
- **Guardrails:** show confidence; items below threshold flagged "verify"; conservative condition grading; hazards → "professional check required".
- **Prompt skeleton:**
  > You are Scout, a materials surveyor. From this walkthrough video and narration, list every visible, removable item that could have a next life. For each, return JSON matching the schema: type, count, condition (A–D) with reason, components with material and estimated weight in kg, estimated dimensions, timestamp_seconds, hazards, confidence (0–1). Do not guess hidden materials. If unsure, lower confidence rather than inventing.

### Architect (Search & Design)
- **Purpose:** help buyers find and design with reclaimed stock.
- **Inputs:** text, voice, sketch photo or inspiration photo; budget; location; area.
- **Process:** embed query (Gemini Embedding 2) → Firestore vector KNN filtered by distance → Gemini composes a bill of materials within budget → Gemini image generation renders the space using those materials.
- **Outputs:** shortlist, bill of materials, render, "start negotiation" actions.
- **MVP:** cross-language search working (e.g. Hindi/Bahasa listing found by English query) + one render.

### Market agents (Trade): Seller, Buyer, Bundler
- **Purpose:** close deals automatically within human-set limits, in each person's language.
- **Seller agent:** represents a lister; holds floor price, pickup windows, language. Exposed as an A2A service with an Agent Card.
- **Buyer agent:** represents a buyer; holds budget cap, quality requirements, language.
- **Negotiation protocol (A2A task):** offer → counter → accept/decline, max N rounds; messages are structured JSON (price, quantity, pickup, conditions). Each agent explains each step to its human in their language.
- **Bundler agent:** groups low-value items from nearby homes into one pickup route for a dealer; computes whether the bundle clears the dealer's minimum.
- **Settlement:** on human **Approve**, create an AP2 mandate and settle in sandbox/test mode. Never process real money in the prototype.
- **Guardrails:** hard floor/cap enforced in code (not only in prompt); human approval before any settlement; full negotiation transcript stored.

### Ledger (Prove)
- **Purpose:** verified impact.
- **Process:** for each completed deal or routing, compute mass diverted per material × emission factor (from the UK Government GHG Conversion Factors 2026, material use and waste disposal) and record value recovered.
- **Outputs:** `ledger_entries`; city totals; downloadable impact certificate (PDF) in the user's language; per-item "% recovered by weight".
- **Guardrail:** every number links to its source factor and calculation.

### Ladder decision logic (shared)
For each item/component:
1. If condition ≥ B and a buyer exists within radius → **Reuse**.
2. Else if repair cost estimate (grounded) < value after repair and a repairer exists → **Repair**.
3. Else if an upcycler category matches the material/form → **Upcycle**.
4. Else if components have demand → **Harvest parts**.
5. Else route each material to the nearest matching recycler → **Recycle**.
6. Else **Recover energy** if a facility exists, else **Safe disposal** (hazards → licensed handler).
The model writes the reasoning; code enforces the order and thresholds.

---

## Data model (Firestore)

| Collection | Key fields |
|---|---|
| `participants` | id, role (homeowner/contractor/dealer/repairer/upcycler/recycler/buyer), name, language, location (geopoint), agent_card_url, preferences (floor_price, budget_cap) |
| `sites` | id, owner_id, type (home/building), address, location, media_uris[], status, created_at |
| `items` | id, site_id, type, count, condition, confidence, dimensions, timestamps[], evidence_uris[], hazards[], embedding (vector), ladder_decision, ladder_reason |
| `components` | id, item_id, name, material, est_weight_kg, next_life, destination_participant_id |
| `passports` | id, item_id, value_min, value_max, price_sources[], co2_avoided_kg, factor_source, language_versions{} |
| `listings` | id, item_id, seller_id, floor_price, status |
| `deals` | id, listing_id, buyer_id, seller_id, transcript[], final_price, status, ap2_mandate_ref, approved_at |
| `bundles` | id, dealer_id, item_ids[], route, total_value, status |
| `predictions` | id, source_doc_uri, language, address, location, type (supply/demand), expected_date, expected_materials[], confidence |
| `ledger_entries` | id, deal_or_routing_id, material, mass_kg, co2_kg, value, created_at |
| `events` | id, job_id, agent, step, message, ts (feeds mission control) |

Vector search: `items.embedding` (Gemini Embedding 2; consider a reduced dimension via Matryoshka for speed), filtered by location radius in application code.

---

## Multimodal and multilingual design

| Layer | Inputs | Outputs | Languages (demo) |
|---|---|---|---|
| Oracle | PDFs, scanned notices | Map pins | Hindi + one more (e.g. Bahasa or Japanese) + English |
| Scout | Video, photos, voice narration, tap-test audio | Passports, take-apart voice steps | Hindi, Tamil or another Indian language, English |
| Architect | Text, voice, sketch photo, inspiration photo | Shortlist, render | English |
| Market agents | Voice notes, text | Voice/text updates per participant | Hindi ↔ English (hero moment) |
| Ledger | Deal data | PDF certificate, impact card | User's language |

**Why it matters:** the people who hold most reusable materials in Asia (scrap dealers, small contractors, site workers) often prefer speaking to typing, in their own language. Gemini Embedding 2 puts text, images, video, audio and documents into one shared space across 100+ languages, so a Hindi voice note about a teak door, a photo of the door and an English search for "teak doors" land close together without a translation step.

---

## UX screens

1. **Map (home):** layers toggle (Future · Materials · Destinations · Deals), city totals strip, big **Scan** and **Find** buttons.
2. **Scan (seller):** record video / photo / voice; optional tap test; language picker auto-detected.
3. **Passport:** item card with evidence clip, condition, components, next-life ladder with the chosen rung highlighted, value, CO2, confidence and "verify" flags.
4. **Find / Design (buyer):** search by voice/photo/text; results on map; "Design my space" → render + bill of materials.
5. **Deal room:** split view of the two agents negotiating; each side in its own language; **Approve** button.
6. **Mission control:** live timeline of agents (Oracle → Scout → Architect → Market → Ledger), tool calls, handoffs, latency.
7. **Ledger / City dashboard:** tonnes, CO2, money, % recovered, certificates.
8. **Judge mode:** one-click scenario, auto-advancing, skippable.

Design principles: mobile-first, voice-first, large tap targets, one primary action per screen, hide agent complexity behind two flows (Seller: film it · Buyer: find/design it).

---

## Trust, safety and responsible AI

- **Human in the loop:** no settlement without explicit approval; floor price and budget caps enforced in code.
- **Honesty about accuracy:** confidence scores, "verify" flags, quantity ranges, conservative grading.
- **Hazards:** suspected asbestos or other hazards → never routed to reuse; "professional testing required".
- **Evidence:** every listing keeps its timestamped video/photo evidence to reduce fraud.
- **Privacy:** blur faces in uploaded media before storage/display; location shown at neighbourhood level until a deal is agreed.
- **Transparency:** every value/CO2 number links to its source.
- **Payments:** AP2 in sandbox only; clearly labelled in the UI.
- **Labelled samples:** synthetic permits or test data are marked as such.
- **Model risk:** preview models behind a config flag with a fallback model.

---

## Evaluation plan

- **Test set:** 30–50 short clips (homes, offices, storerooms, a site) labelled by the team: items, counts, materials, condition.
- **Metrics:** item detection precision/recall; material classification accuracy; count error; condition agreement; dedup accuracy; end-to-end latency per layer; cross-language retrieval hit rate (top-5).
- **Process:** script in the repo runs the set and writes a results table; re-run after prompt changes.
- **Reporting:** one slide + one line in the video with our real numbers (whatever they are).

---

## Data sources

| Need | Source |
|---|---|
| Embodied carbon factors | UK Government GHG Conversion Factors for Company Reporting 2026 (DESNZ), Open Government Licence v3.0 |
| Resale prices | Gemini grounding with Google Search (store cited URLs) |
| Repairers, recyclers, dealers | Google Maps Platform Places API, plus seeded demo participants |
| Permits / notices | Public examples where available; otherwise clearly labelled synthetic samples |
| Real footage | Team's own home(s) + one real building/office/renovation site (permission obtained) |
| Validation | One recorded conversation/quote from a scrap dealer, contractor or architect |

---

## Demo plan

### The 3-minute video (shot list)
| Time | Scene | What judges see |
|---|---|---|
| 0:00–0:15 | **"One chair."** Someone about to throw out a broken chair; films it instead | Passport appears; ladder picks repair/parts; "92% recovered" |
| 0:15–0:25 | Problem | 106 bn tonnes, 6.9% circular |
| 0:25–0:50 | **"One building."** Walkthrough with Hindi narration + tap test | Pins fill the map; hazard flag; values and CO2 |
| 0:50–1:10 | Predict | Future pins from local-language permits |
| 1:10–1:40 | Design | Café owner's voice request → render from nearby reclaimed stock |
| 1:40–2:20 | **Hero: cross-language deal** | Hindi-speaking dealer and English-speaking architect; agents negotiate live; Approve → AP2 sandbox → deal line on map |
| 2:20–2:40 | **"One city."** Ledger | City totals tick up; certificate |
| 2:40–2:50 | Under the hood | Mission control + architecture slide (5 s) + eval numbers |
| 2:50–3:00 | Close | "Google Maps for the circular economy." Roadmap: offices, factories, disaster zones |

Rules: real footage, real voices, subtitles for non-English, no dead air, live product (not mock-ups), music low.

### Deck (suggested 10 slides)
1. Title + tagline · 2. Problem (numbers) · 3. Insight (information failure) · 4. Product (the living map) · 5. How it works (5 agents + ladder) · 6. Multimodal & multilingual · 7. Architecture (Google stack) · 8. Proof (real scan, dealer quote, eval numbers) · 9. Business model & positioning · 10. Roadmap + team.

### Business model and positioning
- **Who pays:** demolition contractors and developers (salvage revenue, lower disposal fees, green-building credits); dealers/recyclers (subscriptions or per-deal fee); companies needing verified impact for ESG/EPR reporting.
- **Positioning:** "Europe has reporting tools (Madaster, Concular, Reusemate). Marketplaces like Carousell and OLX only handle what people want. Kintsugi handles everything, down to materials, in any language, built for Asia."

---

## Seven-day build plan

| Day | Member A (AI lead) | Member B (App lead) | Member C (Story lead) |
|---|---|---|---|
| **Sun 11 Oct** | GCP project, Vertex AI access, confirm model IDs; ADK skeleton; Scout prompt v0 on 2 clips | Repo, Firebase Hosting, Cloud Run hello-world, Firestore schema, Maps key | Film home clips (chair etc.) + book a building/office site; collect emission factors; contact 2–3 dealers |
| **Mon 12 Oct** | Scout v1: video → JSON (schema), narration fusion | Map UI with pins; Scan upload flow; Passport screen v1 | Label first 15 test clips; draft video script |
| **Tue 13 Oct** | Scout v2: dedup via embeddings, ladder logic, components; **CHECKPOINT** (see Risks and mitigations) | Mission control event stream; Passport polish | Film building walkthrough; dealer interview/quote |
| **Wed 14 Oct** | Embedding index + Architect search (cross-language); Ledger calc | Find/Design screen; Ledger dashboard | Label remaining clips; sample permit docs (labelled) |
| **Thu 15 Oct** | Market agents over A2A; AP2 sandbox settlement; Bundler v1; Oracle extraction | Deal room split view; voice I/O (Live API) | Translations/subtitles; deck draft |
| **Fri 16 Oct** | Architect render; guardrails in code; run eval | Judge mode; face blur; deploy prod; incognito tests | Rehearse demo; capture screen recordings |
| **Sat 17 Oct** | **Feature freeze 12:00.** Bug fixes, latency, fallbacks | Polish, mobile QA | Edit the 3-minute video; finalise deck |
| **Sun 18 Oct** | Buffer | Final deploy check | **Submit early** (confirm exact deadline time and time zone on the official site) |

Daily 15-minute stand-up at 21:00 IST: what's done, what's blocked, what's next.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scout accuracy on counts/dimensions | High | Reference object, narration, ranges + confidence, human confirm; eval to tune prompts |
| **Checkpoint Tue 13 Oct:** Scout not producing usable inventories from our footage | High | Narrow to fewer item classes and shorter clips; if still failing, simplify building scenes to rooms/offices (same pipeline) |
| Video processing latency in demo | Medium | ≤ 60 s clips, pre-processed judge-mode scenario, progress shown in mission control |
| A2A/AP2 integration time | Medium | Build negotiation as two ADK agents first; wrap as A2A services after; AP2 sandbox or clearly labelled mock settlement if blocked |
| Preview model instability (Embedding 2, others) | Medium | Config flag + fallback model; cache embeddings |
| Judges can't use the link | High | Judge mode, no login, tested in incognito on mobile and desktop; keep the service running through the evaluation window |
| Scope creep | High | Non-goals list; feature freeze Sat 12:00 |
| Credibility of numbers | Medium | Sources linked in-app; real scan + real quote; eval slide |
| Rules/eligibility | High | Re-read official rules: originality, allowed tools/models, team eligibility, submission format |
| Cloud costs | Low | Budget alerts; Flash-tier for cheap steps; short clips |

---

## Submission checklist

- Live prototype URL works in incognito on phone and laptop, no login for judge mode
- 3-minute video uploaded (check required platform/visibility)
- Deck/description completed per official template
- Track selected: Sustainability & Social Impact
- Architecture diagram included
- Eval numbers and sources included
- All team members registered and eligible
- Service kept running through the evaluation window; budget alerts on
- Repo link (if required) with README and setup steps

---

## Roadmap (slide only)

Offices and IT e-waste · factories and machinery · retail store refits · disaster recovery and insurance claims · logistics/transport agents · offline capture for low-connectivity sites · public API for city governments.

---

## Open questions

1. Which building/office site can we film this week (permission)?
2. Which dealer/contractor/architect can give us a real quote?
3. Second demo language besides Hindi and English?
4. AP2 sandbox availability vs. labelled mock settlement: decide by Thu 15 Oct.
5. Frontend framework final choice (Next.js vs React + Vite): decide on Day 0.

---

## Sources

- [AI Builder Cup](https://aibuildercup.com/)
- [Circularity Gap Report 2025 (Circle Economy & Deloitte)](https://circularity-gap.world/updates-collection/global-circularity-rate-fell-to-6-9---despite-growing-recycling)
- [Autodesk Research, AI-powered deconstruction (drywall case study)](https://www.research.autodesk.com/?p=6230)
- [Autodesk Digital Builder Ep 129 (40% emissions, up to 75% offset)](https://www.autodesk.com/blogs/construction/digital-builder-ep-129-ai-sustainability-and-the-long-view-from-autodesk-research/)
- [MIT Technology Review, Catherine De Wolf](https://www.technologyreview.com/2025/02/25/1111253/using-ai-to-reduce-waste-in-the-construction-industry)
- [Saint-Gobain, materials passports and pre-demolition audits](https://media.saint-gobain.com/group/csf4/en/114-115/)
- [Madaster (EU CORDIS)](https://cordis.europa.eu/project/rcn/211978/brief/en)
- [Reusemate (Dealroom)](https://app.dealroom.co/companies/reusemate)
- [Gemini Embedding 2](https://itbrief.co.uk/story/google-debuts-gemini-embedding-2-multimodal-ai-model)
- [Gemini Embedding 2 (languages, model ID)](https://rits.shanghai.nyu.edu/ai/google-launches-gemini-embedding-2-its-first-multimodal-embedding-model/)
- [Agent Payments Protocol (AP2)](https://thepaypers.com/payments/news/google-launches-agent-payments-protocol-ap2)
- [Agent2Agent (A2A) protocol](https://stellagent.ai/insights/a2a-protocol-google-agent-to-agent)
