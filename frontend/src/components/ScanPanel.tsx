import { useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { api } from "../api";
import type { AppState, Job } from "../types";
import { DEMO_CENTER } from "../labels";

interface Props {
  state: AppState;
  onJob: (job: Job, onDone?: (j: Job) => void) => void;
  onScanned: (siteId: string) => void;
}

export default function ScanPanel({ onJob, onScanned }: Props) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [kind, setKind] = useState<"home" | "building">("home");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [where, setWhere] = useState(DEMO_CENTER);
  const [locNote, setLocNote] = useState("Using the demo location in Bengaluru.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Native location permission in the Android app; the browser's geolocation on the web.
  const useMyLocation = async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setWhere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocNote("Using your current location.");
    } catch {
      setLocNote("Location was not shared, so the demo location is used.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files?.length) return setError("Add a video or at least one photo first.");
    setError(null);
    setBusy(true);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    form.append("kind", kind);
    form.append("name", name || (kind === "home" ? "My home" : "My site"));
    form.append("lat", String(where.lat));
    form.append("lng", String(where.lng));
    if (notes) form.append("narration_text", notes);
    try {
      const job = await api.scan(form);
      onJob(job, (done) => {
        setBusy(false);
        if (done.status === "done") onScanned(String(done.result.site_id));
        else setError(done.error ?? "The scan failed.");
      });
    } catch (err) {
      setBusy(false);
      setError((err as Error).message);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <h2>Scan something</h2>
      <p className="muted">
        Film a slow walkthrough, under a minute. Talk while you film in any language: what it is, what's broken.
        Tap tiles or panels near the microphone if you want Scout to listen for hollow ones.
      </p>
      <fieldset className="segmented">
        <legend>What are you scanning?</legend>
        <label><input type="radio" checked={kind === "home"} onChange={() => setKind("home")} /> Something at home</label>
        <label><input type="radio" checked={kind === "building"} onChange={() => setKind("building")} /> A building or site</label>
      </fieldset>
      <div className="capture">
        <label className="capture-btn">
          <input type="file" accept="video/*" capture="environment" onChange={(e) => setFiles(e.target.files)} />
          Film a walkthrough
        </label>
        <label className="capture-btn quiet">
          <input type="file" accept="image/*,video/*" multiple onChange={(e) => setFiles(e.target.files)} />
          Choose photos or a video
        </label>
      </div>
      {files?.length ? (
        <p className="small muted">Ready: {Array.from(files).map((f) => f.name).join(", ")}</p>
      ) : null}
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "home" ? "My home" : "Old office, Koramangala"} />
      </label>
      <label>
        Notes, in any language (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="कुर्सी का पैर टूट गया है" />
      </label>
      <p className="small muted">
        {locNote} <button type="button" className="link" onClick={useMyLocation}>Use my location</button>
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Scout is watching…" : "Scan with Scout"}</button>
    </form>
  );
}
