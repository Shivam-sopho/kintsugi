import { BUSY, isBusy } from "../labels";

/** An error on screen. When Gemini is only busy, a calm note instead of a red error. */
export default function Problem({ text, small = false, onRetry }: { text?: string | null; small?: boolean; onRetry?: () => void }) {
  if (!text) return null;
  if (isBusy(text))
    return (
      <p className={`busy-note ${small ? "small" : ""}`} role="status">
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
        <span>
          {BUSY}
          {onRetry && <> <button type="button" className="link" onClick={onRetry}>Try again</button></>}
        </span>
      </p>
    );
  return <p className={`error ${small ? "small" : ""}`} role="alert">{text}</p>;
}
