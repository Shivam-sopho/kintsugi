import { useEffect, type ReactNode } from "react";

/** A full-screen page over the app on phones, a side panel on wide screens. Escape closes it. */
export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <button type="button" className="back" onClick={onClose}>Back</button>
          <span className="sheet-title">{title}</span>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
