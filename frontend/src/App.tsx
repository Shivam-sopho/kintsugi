import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { useJobs } from "./useJobs";
import { setVoiceReplies, unlockAudio, voiceRepliesOn } from "./speak";
import { inr, sentence, isBusy, problemText } from "./labels";
import MapView, { MapKey, type Layers } from "./components/MapView";
import MapPanel from "./components/MapPanel";
import HomePanel from "./components/HomePanel";
import DealRoom from "./components/DealRoom";
import MissionControl from "./components/MissionControl";
import LedgerPage from "./components/LedgerPage";
import Passport from "./components/Passport";
import Sheet from "./components/Sheet";
import { Logo } from "./components/Icons";
import ProfilePanel from "./components/ProfilePanel";
import DemoStory, { warmDemoVoice } from "./components/DemoStory";
import Celebration from "./components/Celebration";
import NearbyList from "./components/NearbyList";
import AskPanel from "./components/AskPanel";
import { LiveJourney } from "./components/LifeStory";
import { loadPersona, savePersona } from "./persona";
import { locateMe } from "./where";
import CityPicker from "./components/CityPicker";

type Tab = "home" | "map" | "deals" | "impact";

const LAYER_LABEL: Record<keyof Layers, string> = {
  future: "Coming up",
  materials: "Things listed",
  destinations: "Takers",
};

// Simple line icons for the bottom bar (24px grid, stroke follows the text colour).
const ICON: Record<Tab, ReactNode> = {
  home: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />,
  deals: <path d="M4 5h16v10H9l-5 4zM8 9h8M8 12h5" />,
  impact: <path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6zM6 3v18M10 8h5M10 12h5M10 16h3" />,
};
const TAB_LABEL: Record<Tab, string> = { home: "Home", map: "Map", deals: "Handovers", impact: "Ledger" };

// Jobs that move someone's own things along their second life: shown live as its stages.
const LIVE_KINDS = new Set(["scan", "handover", "deal", "autopilot", "request", "market"]);

type SheetState = { kind: "item"; id: string } | { kind: "agents" } | { kind: "profile" } | { kind: "ask" } | { kind: "live" } | null;

export default function App() {
  const { state, job, events, error, refresh, track } = useJobs();
  // The demo story, full screen: a recording to replay, or (recording: null) the live run being tracked.
  type Celebrating = { dealId: string | null; personId: string; levelBefore: string | null; figures?: { kg: number; co2e_kg: number } | null; what?: string; to?: string };
  const [celebrate, setCelebrate] = useState<Celebrating | null>(null);
  // Opens at once (dealId null: "Handing it over…"), then fills in when the hand-over is recorded.
  const onCelebrate = (c: Celebrating | null) => {
    if (c) setSheet(null);
    setCelebrate(c);
  };
  // Fetched quietly after the page loads, with the first chapter's voice, so Run demo starts at once.
  const demoRec = useRef<Promise<Awaited<ReturnType<typeof api.demoRecording>> | null> | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      demoRec.current = api.demoRecording().catch(() => null);
      void warmDemoVoice();
    }, 2500);
    return () => clearTimeout(t);
  }, []);
  const [demo, setDemo] = useState<{ recording: Awaited<ReturnType<typeof api.demoRecording>> | null; n: number } | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [layers, setLayers] = useState<Layers>({ future: true, materials: true, destinations: true });
  const [siteId, setSiteId] = useState<string | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [voice, setVoice] = useState(voiceRepliesOn());
  const [personaId, setPersonaId] = useState(loadPersona());
  const [mapView, setMapView] = useState<"map" | "list">("map");
  const persona = state?.participants.find((p) => p.id === personaId);
  const demoRunning = Boolean(demo) || (job?.kind === "judge_mode" && job.status === "running");
  const negotiating = state?.deals.some((d) => d.status === "negotiating" || d.status === "agreed");
  // Prices buyers' agents agreed for this person's things, waiting for their yes.
  const offers = state?.deals.filter((d) => d.seller_id === personaId && d.status === "agreed" && !d.seller_accepted) ?? [];
  // A negotiation over this person's things (or for them), happening now.
  const talking = state?.deals.find((d) => d.status === "negotiating" && (d.seller_id === personaId || d.buyer_id === personaId));
  const nameOf = (id: string) => state?.participants.find((p) => p.id === id)?.name ?? "A buyer";
  const [focusDeal, setFocusDeal] = useState<string | null>(null);
  const openDeal = (id: string) => {
    setFocusDeal(id);
    setSheet(null);
    setTab("deals");
  };

  const runDemo = async () => {
    try {
      unlockAudio(); // the narration starts seconds later; this tap lets it play
      // The demo is the same sample story every time: replay the recorded run from the start, on
      // this screen only, paced by its narration, so any number of viewers can watch at once without
      // touching each other. It runs for real only when no recording exists yet (once, ever); the
      // server lets only one real run happen at a time and later clicks join it.
      const rec = (await (demoRec.current ?? api.demoRecording())) ?? null;
      setSiteId(null);
      if (rec) {
        setDemo({ recording: rec, n: Date.now() });
      } else {
        track(await api.judgeMode(voiceRepliesOn()));
        setDemo({ recording: null, n: Date.now() });
      }
    } catch (e) {
      alert(problemText((e as Error).message));
    }
  };

  const offer = async (itemId: string) => {
    const j = await api.offerItem(itemId);
    track(j);
    setSheet(null);
    setTab("deals");
  };

  const skipDemo = async () => {
    if (job) await api.skip(job.id).catch(() => undefined);
  };

  // The floating Ask button shrinks to its icon while scrolling down, so it doesn't cover the cards.
  const [fabSmall, setFabSmall] = useState(false);
  const lastTop = useRef(0);
  const onPanelScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (Math.abs(top - lastTop.current) < 8) return;
    setFabSmall(top > lastTop.current && top > 80);
    lastTop.current = top;
  };

  const goHome = () => {
    setSheet(null);
    setDemo(null);
    setCelebrate(null);
    setTab("home");
    document.querySelector(".panel-body")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openItem = (id: string) => setSheet({ kind: "item", id });
  const openSite = (id: string) => {
    setSiteId(id);
    setPredictionId(null);
    setTab("map");
  };

  const toggleVoice = () => {
    setVoiceReplies(!voice);
    setVoice(!voice);
  };

  const sheetItem = sheet?.kind === "item" ? state?.items.find((i) => i.id === sheet.id) : undefined;
  const mapPanelEmpty = !siteId && !predictionId;

  return (
    <div className="app" onPointerDownCapture={unlockAudio}>
      <header className="topbar">
        <div className="brand">
          <h1>
            <button type="button" className="home-link" aria-label="Kintsugi: go to Home" onClick={goHome}>
              <Logo size={30} />
              <span>Kintsugi</span>
            </button>
          </h1>
          <p>Google Maps for the circular economy</p>
        </div>
        {state?.mock_mode && <span className="badge" title="Running on sample data with no live AI calls">Sample data</span>}
        <button className={`voice-toggle ${voice ? "on" : ""}`} onClick={toggleVoice} aria-pressed={voice}
                title={voice ? "Kintsugi reads its answers aloud" : "Answers are shown, not read aloud"}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {voice ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                   : <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
          </svg>
          <span>{voice ? "Voice on" : "Voice off"}</span>
        </button>
        <button className="avatar" onClick={() => setSheet({ kind: "profile" })} aria-label={`Profile: ${persona?.name ?? "you"}`} title="Profile and history">
          {(persona?.name ?? "Y").slice(0, 1)}
        </button>
        <button className="demo-btn" onClick={runDemo} disabled={demoRunning}>
          {demoRunning ? "Demo running…" : <><span className="long">Run demo</span><span className="short">Demo</span></>}
        </button>
      </header>

      {talking && tab !== "deals" ? (
        <button className="banner offer-banner live" onClick={() => openDeal(talking.id)}>
          <i className="live-dot" aria-hidden="true" />{" "}
          <strong>{nameOf(talking.seller_id === personaId ? talking.buyer_id : talking.seller_id)}'s agent is negotiating with yours, live.</strong>{" "}
          Two agents, over A2A. Watch
        </button>
      ) : offers.length > 0 && tab !== "deals" ? (
        <button className="banner offer-banner" onClick={() => openDeal(offers[0].id)}>
          <strong>{offers.length === 1 ? "An offer is waiting for you" : `${offers.length} offers are waiting for you`}.</strong>{" "}
          {nameOf(offers[0].buyer_id)}'s agent agreed {inr(offers[0].final_price_inr)} with yours. See it
        </button>
      ) : null}
      {error && <p className={`banner ${isBusy(error) ? "busy-note" : "error"}`} role="status">{isBusy(error) ? "Reconnecting to Kintsugi… it picks up where it left off." : error}</p>}

      <main className={`layout tab-${tab === "map" && mapView === "list" ? "maplist" : tab === "impact" ? "ledger" : tab}`}>
        <div className="map-wrap">
          {state && (
            <MapView
              state={state}
              layers={layers}
              selectedSiteId={siteId}
              onSelectSite={openSite}
              onSelectPrediction={(id) => {
                setPredictionId(id);
                setSiteId(null);
                setTab("map");
              }}
            />
          )}
          <div className="layer-toggles" role="group" aria-label="Map layers">
            <button className="chip view-toggle" onClick={() => { setMapView("list"); setTab("map"); }}>Show as list</button>
            <CityPicker className="chip" />
            <MapKey />
            <button className="chip near-me" onClick={() => locateMe().catch((e) => alert((e as Error).message))}>Near me</button>
            {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
              <button
                key={k}
                className={`chip ${k} ${layers[k] ? "on" : ""}`}
                aria-pressed={layers[k]}
                onClick={() => setLayers({ ...layers, [k]: !layers[k] })}
              >
                {LAYER_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <section className={`panel ${tab === "map" && mapView === "map" && mapPanelEmpty ? "map-empty" : ""}`}>
          <div className="panel-body" key={tab} onScroll={onPanelScroll}>
            {!state ? (
              <p className="muted">Loading…</p>
            ) : tab === "home" ? (
              <HomePanel
                state={state}
                job={job}
                events={events}
                personaId={personaId}
                onJob={track}
                onOpenItem={openItem}
                onOpenAgents={() => job?.kind === "judge_mode" ? setDemo({ recording: null, n: Date.now() }) : setSheet( LIVE_KINDS.has(job?.kind ?? "") ? { kind: "live" } : { kind: "agents" })}
                onSkip={skipDemo}
                onDealStarted={() => setTab("deals")}
                onRunDemo={runDemo}
                demoRunning={demoRunning}
                onChanged={refresh}
              />
            ) : tab === "map" && mapView === "list" ? (
              <NearbyList state={state} onOpenItem={openItem} onShowMap={() => setMapView("map")} />
            ) : tab === "map" ? (
              <MapPanel
                state={state}
                siteId={siteId}
                predictionId={predictionId}
                itemId={null}
                onSelectItem={(id) => id && openItem(id)}
                onRunDemo={runDemo}
                demoRunning={demoRunning}
                onChanged={refresh}
                onOffer={offer}
                onClose={() => {
                  setSiteId(null);
                  setPredictionId(null);
                }}
              />
            ) : tab === "deals" ? (
              <DealRoom state={state} onChanged={refresh} onOpenItem={openItem} onCelebrate={onCelebrate} focus={focusDeal} />
            ) : (
              <LedgerPage state={state} personaId={personaId} onOpenItem={openItem} onOpenDeals={() => setTab("deals")} />
            )}
          </div>
        </section>
      </main>

      {!sheet && state && (
        <button className={`ask-fab ${fabSmall ? "small" : ""}`} onClick={() => setSheet({ kind: "ask" })} aria-label="Ask Kintsugi, by voice or text">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          Ask Kintsugi
        </button>
      )}

      <nav className="bottom-nav" aria-label="Sections">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
              {ICON[t]}
            </svg>
            <span>{TAB_LABEL[t]}</span>
            {t === "deals" && negotiating && <i className="live-dot" aria-label="deal in progress" />}
          </button>
        ))}
      </nav>

      {sheet?.kind === "item" && sheetItem && state && (
        <Sheet title={sentence(sheetItem.type)} onClose={() => setSheet(null)}>
          <Passport key={sheetItem.id} item={sheetItem} state={state} onBack={() => setSheet(null)} onChanged={refresh} onOffer={offer} onJob={track} onCelebrate={onCelebrate} />
        </Sheet>
      )}
      {sheet?.kind === "profile" && state && (
        <Sheet title="Profile" onClose={() => setSheet(null)}>
          <ProfilePanel
            state={state}
            personaId={personaId}
            onChangePersona={(id) => {
              savePersona(id);
              setPersonaId(id);
            }}
            onOpenItem={openItem}
          />
        </Sheet>
      )}
      {celebrate && state && (
        <Celebration
          dealId={celebrate.dealId}
          figures={celebrate.figures}
          what={celebrate.what}
          to={celebrate.to}
          levelBefore={celebrate.levelBefore}
          personaId={celebrate.personId}
          state={state}
          onClose={() => setCelebrate(null)}
          onOpenLedger={() => {
            setCelebrate(null);
            setTab("impact");
          }}
        />
      )}
      {demo && (
        <DemoStory
          key={demo.n}
          recording={demo.recording}
          job={job}
          events={events}
          state={state}
          onClose={() => setDemo(null)}
          onShowSteps={() => setSheet({ kind: "agents" })}
          onFinish={(t) => {
            setDemo(null);
            setTab(t);
          }}
          onRefresh={refresh}
        />
      )}
      {sheet?.kind === "ask" && state && (
        <Sheet title="Ask Kintsugi" onClose={() => setSheet(null)}>
          <AskPanel
            state={state}
            personaId={personaId}
            onOpenItem={openItem}
            onJob={track}
            onGoToDeals={() => {
              setSheet(null);
              setTab("deals");
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === "live" && job && (
        <Sheet title="Its second life, live" onClose={() => setSheet(null)}>
          <LiveJourney job={job} events={events} state={state} onOpenItem={openItem} onShowSteps={() => setSheet({ kind: "agents" })} />
        </Sheet>
      )}
      {sheet?.kind === "agents" && (
        <Sheet title="What the agents did" onClose={() => setSheet(null)}>
          <MissionControl job={job} events={events} onSkip={skipDemo} />
        </Sheet>
      )}
    </div>
  );
}
