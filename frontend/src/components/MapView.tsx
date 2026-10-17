import { useEffect, useMemo, useRef, useState } from "react";
import { AdvancedMarker, APIProvider, Map, Polyline } from "@vis.gl/react-google-maps";
import ErrorBoundary from "./ErrorBoundary";
import type { AppState, GeoPoint, Item, Rung } from "../types";
import { DEMO_CENTER, RUNG_COLOR, RUNG_ORDER } from "../labels";

export type Layers = { flows: boolean; future: boolean; materials: boolean; destinations: boolean; deals: boolean };

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

export interface Seam {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
  kind: "deal" | "route";
}

/** A line from a listed thing to a taker its parts go to, coloured by that next life. */
export interface Flow {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
  rung: Rung;
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
    const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
    const siteById = Object.fromEntries(state.sites.map((s) => [s.id, s]));
    const itemById = Object.fromEntries(state.items.map((i) => [i.id, i]));
    const seams: Seam[] = [];
    for (const d of state.deals) {
      if (!["agreed", "approved", "settled"].includes(d.status)) continue;
      const it = itemById[d.item_ids[0]];
      const buyer = people[d.buyer_id];
      if (it && buyer) seams.push({ id: d.id, from: it.location, to: buyer.location, kind: "deal" });
    }
    for (const b of state.bundles) {
      const dealer = people[b.dealer_id];
      if (!dealer) continue;
      let prev = dealer.location;
      for (const sid of b.route) {
        const s = siteById[sid];
        if (!s) continue;
        seams.push({ id: `${b.id}-${sid}`, from: prev, to: s.location, kind: "route" });
        prev = s.location;
      }
    }
    // The circular flows: every listed thing to each taker its parts go to.
    const flows: Flow[] = [];
    const seen = new Set<string>();
    for (const it of state.items) {
      const routes = it.destination_id && it.next_life
        ? [{ dest: it.destination_id, rung: it.next_life }]
        : it.components.filter((c) => c.destination_id && c.next_life).map((c) => ({ dest: c.destination_id!, rung: c.next_life! }));
      for (const r of routes) {
        const taker = people[r.dest];
        const key = `${it.site_id}|${r.dest}|${r.rung}`;
        if (!taker || seen.has(key)) continue;
        seen.add(key);
        flows.push({ id: key, from: it.location, to: taker.location, rung: r.rung });
      }
    }
    return { sites, seams, flows };
  }, [state]);
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
  const { sites, seams, flows } = useMapModel(state);
  return (
    <APIProvider apiKey={MAPS_KEY!}>
      <Map
        mapId={MAP_ID}
        defaultCenter={DEMO_CENTER}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI
        className="map-canvas"
      >
        {layers.flows &&
          flows.map((f) => (
            <Polyline key={f.id} path={[f.from, f.to]} strokeColor={RUNG_COLOR[f.rung]} strokeWeight={4} strokeOpacity={0.9} geodesic />
          ))}
        {layers.deals &&
          seams.map((s) => (
            <Polyline
              key={s.id}
              path={[s.from, s.to]}
              strokeColor={s.kind === "deal" ? "#B8892B" : "#6E9E8A"}
              strokeWeight={s.kind === "deal" ? 5 : 2}
              strokeOpacity={s.kind === "deal" ? 0.95 : 0.8}
              geodesic
            />
          ))}
        {layers.future &&
          state.predictions.map((p) => (
            <AdvancedMarker key={p.id} position={p.location} onClick={() => onSelectPrediction(p.id)} title={p.title}>
              <span className={`future-pin ${p.kind}`} />
            </AdvancedMarker>
          ))}
        {layers.destinations &&
          state.participants.filter((p) => p.role !== "homeowner").map((p) => (
            <AdvancedMarker key={p.id} position={p.location} title={`${p.name} (${p.role})`}>
              <span className="dest-pin" />
            </AdvancedMarker>
          ))}
        {layers.materials &&
          spread(sites).map(({ s, at }) => (
            <AdvancedMarker key={s.id} position={at} onClick={() => onSelectSite(s.id)} title={s.name}>
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
  const { sites, seams, flows } = useMapModel(state);
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
        {layers.flows &&
          flows.map((f) => (
            <line key={f.id} className="flow" stroke={RUNG_COLOR[f.rung]} x1={x(f.from)} y1={y(f.from)} x2={x(f.to)} y2={y(f.to)} />
          ))}
        {layers.deals &&
          seams.map((s) => (
            <line
              key={s.id}
              className={s.kind === "deal" ? "seam" : "route"}
              x1={x(s.from)} y1={y(s.from)} x2={x(s.to)} y2={y(s.to)}
            />
          ))}
        {layers.future &&
          state.predictions.map((p) => (
            <g key={p.id} className={`future ${p.kind}`} onClick={() => onSelectPrediction(p.id)}
               onKeyDown={(e) => e.key === "Enter" && onSelectPrediction(p.id)} role="button" tabIndex={0}
               aria-label={p.title}>
              <circle cx={x(p.location)} cy={y(p.location)} r={15} />
              <title>{p.title}</title>
            </g>
          ))}
        {layers.destinations &&
          state.participants.filter((p) => p.role !== "homeowner").map((p) => (
            <g key={p.id} className="dest">
              <rect x={x(p.location) - 5} y={y(p.location) - 5} width={10} height={10} rx={2} />
              <title>{`${p.name} (${p.role})`}</title>
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
                <title>{s.name}</title>
              </g>
            );
          })}
      </svg>
      <ul className="map-legend" aria-label="Map key">
        <li><i className="k-site" />Scanned items</li>
        <li><i className="k-future" />Coming up</li>
        <li><i className="k-dest" />Takers</li>
        <li><i className="k-seam" />Deal</li>
        <li><i className="k-route" />Pickup route</li>
      </ul>
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
