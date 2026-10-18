import { useEffect, useState } from "react";
import { api } from "../api";
import type { AppState, Standing } from "../types";
import { kg } from "../labels";
import { Logo } from "./Icons";

/** The account's circular standing: the level it has earned from hand-overs, sales and pickups,
 *  progress to the next one, and a certificate to download. */
export default function StandingCard({ state, personId }: { state: AppState; personId: string }) {
  const [st, setSt] = useState<Standing | null>(null);
  const settled = state.deals.filter((d) => d.status === "settled").length;

  useEffect(() => {
    let alive = true;
    api.standing(personId).then((s) => alive && setSt(s)).catch(() => alive && setSt(null));
    return () => {
      alive = false;
    };
  }, [personId, settled]);

  if (!st) return null;
  const next = st.next;
  const progress = next ? Math.min(1, Math.max(st.items / next.items, next.kg ? st.kg / next.kg : 0)) : 1;
  return (
    <section className={`standing ${st.level ? "" : "none"}`} aria-label="Circular standing">
      <span className="seal" aria-hidden="true"><Logo size={34} /></span>
      <div>
        <span className="small muted">Circular standing</span>
        <h3>{st.level ?? "Not earned yet"}</h3>
        <span className="small">
          {st.items
            ? `${st.items} ${st.items === 1 ? "thing" : "things"} given or taken a next life, ${kg(st.kg)} kept out of landfill, ${kg(st.co2e_kg)} CO2e avoided.`
            : "Hand over or sell your first thing to earn Circular starter."}
        </span>
        {next && (
          <>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="small muted">Next: {next.name}, {next.to_go}.</span>
          </>
        )}
      </div>
      {st.level && (
        <div className="actions">
          <a className="secondary button" href={api.standingPdfUrl(personId)} download target="_blank" rel="noreferrer">
            Download certificate (PDF)
          </a>
          <span className="small muted">{st.handovers} {st.handovers === 1 ? "hand-over" : "hand-overs"}, {st.sales} {st.sales === 1 ? "sale" : "sales"}. Counted from settled records only.</span>
        </div>
      )}
    </section>
  );
}
