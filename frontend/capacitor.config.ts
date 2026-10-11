import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android app for Kintsugi.
 *
 * Two ways to point the app at the backend (see android/README.md):
 *  - Recommended: CAP_SERVER_URL=https://<project>.web.app npx cap sync android
 *    The app loads the hosted web app, so it is always the latest deploy and /api works as-is.
 *  - Bundled: set VITE_API_BASE=https://<cloud-run-url> in .env.local, npm run build, npx cap sync android.
 */
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "app.kintsugi.circular",
  appName: "Kintsugi",
  webDir: "dist",
  android: {
    path: "../android",
  },
  server: serverUrl
    ? { url: serverUrl, cleartext: serverUrl.startsWith("http://") }
    : { androidScheme: "https" },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
