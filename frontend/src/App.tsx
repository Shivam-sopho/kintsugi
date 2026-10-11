import { useState } from "react";
import { api } from "./api";
import { useJobs } from "./useJobs";
import MapView, { type Layers } from "./components/MapView";
import MapPanel from "./components/MapPanel";
import ScanPanel from "./components/ScanPanel";
import FindPanel from "./components/FindPanel";
import DealRoom from "./components/DealRoom";
import MissionControl from "./components/MissionControl";
import ImpactPanel from "./components/ImpactPanel";

type Tab = "map" | "scan" | "find" | "deal" | "agents" | "impact";
const TABS: { id: Tab; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "scan", label: "Scan" },
  { id: "find", label: "Find" },
  { id: "deal", label: "Deal" },
  { id: "agents", label: "Agents" },
  { id: "impact", label: "Impact" },
];

const LAYER_LABEL: Record<keyof Layers, string> = {
  future: "Coming up",
  materials: "Materials",
  destinations: "Takers",
  deals: "Deals",
};

export default function App() {
  const { state, job, events, error, refresh, track } = useJobs();
  const [tab, setTab] = useState<Tab>("map");
  const [layers, setLayers] = useState<Layers>({ future: true, materials: true, destinations: true, deals: true });
  const [siteId, setSiteId] = useState<string | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const demoRunning = job?.kind === "judge_mode" && job.status === "running";

  const runDemo = async () => {
    try {
      const j = await api.judgeMode();
      track(j, () => setTab("impact"));
      setSiteId(null);
      setItemId(null);
      setTab("agents");
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const openSite = (id: string) => {
    setSiteId(id);
    setPredictionId(null);
    setItemId(null);
    setTab("map");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Kintsugi</h1>
          <p>Google Maps for the circular economy</p>
        </div>
        {state?.mock_mode && <span className="badge" title="Running on sample data with no live AI calls">Sample data</span>}
        <button className="primary gold" onClick={runDemo} disabled={demoRunning}>
          {demoRunning ? "Demo running…" : "Run demo"}
        </button>
      </header>

      {error && <p className="banner error" role="alert">{error}</p>}

      <main className="layout">
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
                setItemId(null);
                setTab("map");
              }}
            />
          )}
          <div className="layer-toggles" role="group" aria-label="Map layers">
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

        <aside className="panel">
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === "agents" && job?.status === "running" && <i className="live-dot" aria-label="running" />}
              </button>
            ))}
          </nav>
          <div className="panel-body" key={tab}>
            {!state ? (
              <p className="muted">Loading…</p>
            ) : tab === "map" ? (
              <MapPanel
                state={state}
                siteId={siteId}
                predictionId={predictionId}
                itemId={itemId}
                onSelectItem={setItemId}
                onRunDemo={runDemo}
                demoRunning={demoRunning}
              />
            ) : tab === "scan" ? (
              <ScanPanel state={state} onJob={(j, cb) => { track(j, cb); }} onScanned={openSite} />
            ) : tab === "find" ? (
              <FindPanel
                state={state}
                onJob={track}
                onDealStarted={() => setTab("deal")}
                onOpenItem={(id) => {
                  const it = state.items.find((i) => i.id === id);
                  if (it) setSiteId(it.site_id);
                  setItemId(id);
                  setTab("map");
                }}
              />
            ) : tab === "deal" ? (
              <DealRoom state={state} onChanged={refresh} />
            ) : tab === "agents" ? (
              <MissionControl job={job} events={events} />
            ) : (
              <ImpactPanel state={state} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
