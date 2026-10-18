import { useEffect, useState } from "react";
import { api } from "../api";
import { goToCity, useWhere, type City } from "../where";
import { km } from "../labels";

let cached: City[] | null = null;

/** Choose a city with sample data: the map, distances, search and Ask all follow it. */
export default function CityPicker({ className = "" }: { className?: string }) {
  const where = useWhere();
  const [list, setList] = useState<City[]>(cached ?? []);
  useEffect(() => {
    if (cached) return;
    api.cities().then((c) => {
      cached = c;
      setList(c);
    }, () => undefined);
  }, []);
  if (!list.length) return null;
  // The city shown: the one picked, or the nearest to where the person is.
  const nearest = list.reduce((a, b) => (km(where, a) <= km(where, b) ? a : b));
  const value = km(where, nearest) < 60 ? nearest.id : "";
  return (
    <label className={`city-picker ${className}`}>
      <span className="sr-only">City</span>
      <select value={value} onChange={(e) => { const c = list.find((x) => x.id === e.target.value); if (c) goToCity(c); }}>
        {!value && <option value="">Your location</option>}
        {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
