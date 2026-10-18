import { useEffect, useMemo, useRef, useState } from "react";
import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import ErrorBoundary from "./ErrorBoundary";
import type { AppState, GeoPoint, Item, Participant, Prediction, Rung } from "../types";
import { DEMO_CENTER, RUNG_COLOR, RUNG_LABEL, RUNG_ORDER, TAKER_ROLE, km } from "../labels";
import { useWhere, type Where } from "../where";

export type Layers = { future: boolean; materials: boolean; destinations: boolean };

interface Props {
  state: AppState;
  layers: Layers;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  onSelectPrediction: (id: string) => void;
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined) || "DEMO_MAP_ID";

export interface SitePin {
  id: string;
  name: string;
  location: GeoPoint;
  items: Item[];
  best: Rung | null;
  hazard: boolean;
  open: number;
}



export function useMapModel(state: AppState) {
  return useMemo(() => {
    const bySite: Record<string, Item[]> = {};
    for (const it of state.items) (bySite[it.site_id] ??= []).push(it);
    const sites: SitePin[] = state.sites.map((s) => {
      const items = bySite[s.id] ?? [];
      const rungs = items.map((i) => i.next_life).filter(Boolean) as Rung[];
      const best = rungs.length ? RUNG_ORDER.find((r) => rungs.includes(r)) ?? null : null;
      return {
        id: s.id,
        name: s.name,
        location: s.location,
        items,
        best,
        hazard: items.some((i) => i.hazards.length > 0),
        open: items.filter((i) => i.status === "available").length,
      };
    });
    return { sites };
  }, [state]);
}

// What a pin means, in words, when you hover or long-press it.
function siteTitle(s: SitePin): string {
  const kinds = `${s.items.length} ${s.items.length === 1 ? "kind of thing" : "kinds of things"} listed`;
  const open = s.open === s.items.length ? "" : `, ${s.open} still looking for a next life`;
  const best = s.best ? ` Ring colour: the best next life here is ${RUNG_LABEL[s.best].toLowerCase()}.` : "";
  const hazard = s.hazard ? " Red dot: a suspected hazard, which goes to a licensed handler." : "";
  return `${s.name}: ${kinds}${open}.${best}${hazard} Tap to see them.`;
}

function takerTitle(p: Participant): string {
  const takes = [...p.accepts_materials, ...p.accepts_types].slice(0, 4).join(", ");
  return `${p.name}: ${TAKER_ROLE[p.role] ?? p.role}${takes ? `, takes ${takes}` : ""}.`;
}

function predictionTitle(p: Prediction): string {
  const what = p.kind === "supply" ? "Coming up: things will be freed here" : "Coming up: someone here will need things";
  return `${what}. ${p.title}, expected ${p.expected_date}. Read from a public notice. Tap for details.`;
}

/** The key: what every shape, colour and number on the map means. */
export function MapKey() {
  return (
    <details className="map-key">
      <summary>Map key</summary>
      <div className="map-key-panel">
        <ul>
          <li><i className="k-site">3</i>A home or site with things listed. The number is how many kinds of things.</li>
          <li><i className="k-hazard" />Red dot: a suspected hazard, sent to a licensed handler.</li>
          <li><i className="k-dest" />A taker: recycler, buyer, charity, compost unit, municipal centre.</li>
          <li><i className="k-future" />Coming up, from public notices: dark ring, things will be freed; gold ring, someone will need them.</li>
          <li><i className="k-you" />You.</li>
        </ul>
        <p className="small">Ring colours are the best next life there, best first:</p>
        <ul className="k-rungs">
          {RUNG_ORDER.map((r) => <li key={r}><i style={{ background: RUNG_COLOR[r] }} />{RUNG_LABEL[r]}</li>)}
        </ul>
        <p className="small muted">Where things are going, and every hand-over and deal, are listed in Handovers.</p>
      </div>
    </details>
  );
}

/** Keep the map on the person once they share where they are. */
function FollowMe({ where }: { where: Where }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (first.current) {
      first.current = false;
      return;
    }
    map.panTo({ lat: where.lat, lng: where.lng });
    map.setZoom(13);
  }, [map, where]);
  return null;
}

export default function MapView(props: Props) {
  if (!MAPS_KEY) return <SchematicMap {...props} />;
  // If Google Maps can't load (blocked, offline, key problem), fall back to the schematic map.
  return <ErrorBoundary fallback={<SchematicMap {...props} />}><GoogleMapView {...props} /></ErrorBoundary>;
}

function pinStyle(p: SitePin, selected: boolean): React.CSSProperties {
  const color = p.best ? RUNG_COLOR[p.best] : "#8C939E";
  return { borderColor: color, boxShadow: selected ? `0 0 0 3px ${color}55` : undefined };
}

function GoogleMapView({ state, layers, selectedSiteId, onSelectSite, onSelectPrediction }: Props) {
  const { sites } = useMapModel(state);
  const where = useWhere();
  return (
    <APIProvider apiKey={MAPS_KEY!}>
      <Map
        mapId={MAP_ID}
        defaultCenter={where.mine ? { lat: where.lat, lng: where.lng } : DEMO_CENTER}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI
        className="map-canvas"
      >
        <FollowMe where={where} />
        <AdvancedMarker position={{ lat: where.lat, lng: where.lng }} title={where.mine ? "You are here" : `Looking around ${where.label} (sample data). Share your location with Near me.`} zIndex={10}>
          <span className="you-pin">You</span>
        </AdvancedMarker>
        {layers.future &&
          state.predictions.map((p) => (
            <AdvancedMarker key={p.id} position={p.location} onClick={() => onSelectPrediction(p.id)} title={predictionTitle(p)}>
              <span className={`future-pin ${p.kind}`} />
            </AdvancedMarker>
          ))}
        {layers.destinations &&
          state.participants.filter((p) => p.role !== "homeowner").map((p) => (
            <AdvancedMarker key={p.id} position={p.location} title={takerTitle(p)}>
              <span className="dest-pin" />
            </AdvancedMarker>
          ))}
        {layers.materials &&
          spread(sites).map(({ s, at }) => (
            <AdvancedMarker key={s.id} position={at} onClick={() => onSelectSite(s.id)} title={siteTitle(s)}>
              <span className="site-pin" style={pinStyle(s, s.id === selectedSiteId)}>
                {s.items.length}
                {s.hazard && <i className="hazard-dot" aria-label="hazard" />}
              </span>
            </AdvancedMarker>
          ))}
      </Map>
    </APIProvider>
  );
}

// Neighbourhood names so the offline map is readable (demo city: Bengaluru).
const PLACES: { name: string; lat: number; lng: number }[] = [
  { name: "Koramangala", lat: 12.9352, lng: 77.6145 },
  { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { name: "HSR Layout", lat: 12.9055, lng: 77.6474 },
  { name: "Jayanagar", lat: 12.9299, lng: 77.5838 },
  { name: "Peenya", lat: 13.0329, lng: 77.5195 },
  { name: "Whitefield", lat: 12.9698, lng: 77.7499 },
];

/** Offline map used when no Maps key is set: same layers, projected to fit the panel. */
function SchematicMap({ state, layers, selectedSiteId, onSelectSite, onSelectPrediction }: Props) {
  const where = useWhere();
  // The offline map draws one area: what's within 40 km of the chosen city or the person.
  const near = (g: GeoPoint) => km(where, g) < 40;
  state = { ...state, sites: state.sites.filter((x) => near(x.location)), items: state.items.filter((x) => near(x.location)),
            participants: state.participants.filter((x) => near(x.location)), predictions: state.predictions.filter((x) => near(x.location)) };
  const { sites } = useMapModel(state);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 800, h: e.contentRect.height || 600 }));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const pts: GeoPoint[] = [
    ...state.sites.map((s) => s.location),
    ...state.participants.map((p) => p.location),
    ...state.predictions.map((p) => p.location),
    where,
  ];
  if (pts.length < 2) pts.push(DEMO_CENTER, { lat: DEMO_CENTER.lat + 0.05, lng: DEMO_CENTER.lng + 0.05 });
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const { w: W, h: H } = size;
  const margin = 56;
  const scale = Math.min((W - 2 * margin) / (maxLng - minLng || 0.01), (H - 2 * margin) / (maxLat - minLat || 0.01));
  const ox = (W - (maxLng - minLng) * scale) / 2;
  const oy = (H - (maxLat - minLat) * scale) / 2;
  const x = (g: GeoPoint) => ox + (g.lng - minLng) * scale;
  const y = (g: GeoPoint) => H - oy - (g.lat - minLat) * scale;

  return (
    <div className="map-canvas schematic" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Schematic map of sites, takers and deals">
        <defs>
          <pattern id="blocks" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M36 0H0V36" fill="none" stroke="#E2E5E1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#blocks)" />
        {PLACES.map((p) => (
          <text key={p.name} className="place" x={x(p)} y={y(p) + 34} textAnchor="middle">{p.name}</text>
        ))}
        {layers.future &&
          state.predictions.map((p) => (
            <g key={p.id} className={`future ${p.kind}`} onClick={() => onSelectPrediction(p.id)}
               onKeyDown={(e) => e.key === "Enter" && onSelectPrediction(p.id)} role="button" tabIndex={0}
               aria-label={p.title}>
              <circle cx={x(p.location)} cy={y(p.location)} r={15} />
              <title>{predictionTitle(p)}</title>
            </g>
          ))}
        {layers.destinations &&
          state.participants.filter((p) => p.role !== "homeowner").map((p) => (
            <g key={p.id} className="dest">
              <rect x={x(p.location) - 5} y={y(p.location) - 5} width={10} height={10} rx={2} />
              <title>{takerTitle(p)}</title>
            </g>
          ))}
        {layers.materials &&
          sites.map((s) => {
            const color = s.best ? RUNG_COLOR[s.best] : "#8C939E";
            const cx = x(s.location), cy = y(s.location);
            return (
              <g
                key={s.id}
                className="site"
                onClick={() => onSelectSite(s.id)}
                onKeyDown={(e) => e.key === "Enter" && onSelectSite(s.id)}
                role="button"
                tabIndex={0}
                aria-label={`${s.name}, ${s.items.length} items`}
              >
                {s.id === selectedSiteId && <circle cx={cx} cy={cy} r={26} fill={color} opacity={0.2} />}
                <circle cx={cx} cy={cy} r={16} fill="#fff" stroke={color} strokeWidth={4} />
                <text x={cx} y={cy + 5} textAnchor="middle">{s.items.length}</text>
                {s.hazard && <circle cx={cx + 12} cy={cy - 12} r={5} fill="#B23A2B" />}
                <title>{siteTitle(s)}</title>
              </g>
            );
          })}
        <g className="you" aria-label={where.mine ? "You are here" : "Demo location"}>
          <circle cx={x(where)} cy={y(where)} r={9} />
          <text x={x(where)} y={y(where) - 14} textAnchor="middle">You</text>
          <title>{where.mine ? "You are here" : "Demo location (you, until you share your location)"}</title>
        </g>
      </svg>
      <p className="map-note">Schematic view. Add a Google Maps key to see the real map.</p>
    </div>
  );
}

/** Pins closer than about 300 m overlap at city zoom: fan them out in a small ring (display only;
 *  home locations are already approximate). */
function spread<T extends { location: { lat: number; lng: number } }>(points: T[]): { s: T; at: { lat: number; lng: number } }[] {
  const out: { s: T; at: { lat: number; lng: number } }[] = [];
  const groups: T[][] = [];
  for (const p of points) {
    const g = groups.find((grp) => Math.abs(grp[0].location.lat - p.location.lat) < 0.003 && Math.abs(grp[0].location.lng - p.location.lng) < 0.003);
    if (g) g.push(p);
    else groups.push([p]);
  }
  for (const g of groups) {
    if (g.length === 1) {
      out.push({ s: g[0], at: g[0].location });
      continue;
    }
    const c = g[0].location;
    g.forEach((p, i) => {
      const a = (2 * Math.PI * i) / g.length;
      out.push({ s: p, at: { lat: c.lat + 0.004 * Math.sin(a), lng: c.lng + 0.004 * Math.cos(a) } });
    });
  }
  return out;
}
