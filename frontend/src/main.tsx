import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <main className="crash">
          <h1>Something went wrong</h1>
          <p>Your data is safe. Reload to carry on.</p>
          <button className="primary" onClick={() => location.reload()}>Reload</button>
        </main>
      }
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Installable app (PWA). Skipped inside the Android app, which bundles its own shell.
const isNative = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
if ("serviceWorker" in navigator && import.meta.env.PROD && !isNative) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}
