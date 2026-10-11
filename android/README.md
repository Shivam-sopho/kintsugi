# Kintsugi Android app

A native Android app (Capacitor 8) that runs the same Kintsugi screens as the web app, with native camera, microphone and location permissions. Use it to film walkthroughs for Scout, show the deal room on a phone, and record the demo video.

Status: the project was generated and configured, but it has **not been compiled yet** (the workspace it was built in can't download the Android SDK). Expect to do the first build in Android Studio on Day 1.

## What's native

- App icon and splash screen in the Kintsugi palette (`app/src/main/res`, generated from `frontend/assets/`)
- Permissions: camera and microphone (filming with narration and tap tests), location (placing scans on the map)
- Native location through `@capacitor/geolocation`
- The Scan screen's "Video or photos" opens the phone camera directly
- Status bar and safe areas handled (indigo top bar runs under the status bar)

## Build it

You need Android Studio (recent stable) and the Android SDK it installs. From the repo root:

```bash
cd frontend
npm install                 # the Android project links to Capacitor inside frontend/node_modules
```

Then pick how the app reaches the backend.

**A. Load the deployed app (recommended for the demo).** The app opens your Firebase Hosting site, so it's always the latest deploy and `/api` works without extra setup.

```bash
CAP_SERVER_URL=https://<project>.web.app npm run android:sync
```

**B. Bundle the screens in the APK.** Works offline for the UI; calls your Cloud Run API directly (CORS is open by default).

```bash
echo "VITE_API_BASE=https://<cloud-run-url>" >> .env.local
npm run android:sync
```

**C. Local development with live reload** (laptop and phone on the same Wi-Fi, or the emulator):

```bash
# terminal 1: backend on :8080 (see the main README)
# terminal 2:
npm run dev -- --host
CAP_SERVER_URL=http://<your-laptop-ip>:5173 npx cap sync android   # emulator: http://10.0.2.2:5173
```

Open and run:

```bash
npm run android:open        # opens ../android in Android Studio
```

In Android Studio press Run with a phone connected (USB debugging on), or use **Build → Build App Bundle(s) / APK(s) → Build APK(s)** to get an APK you can share with your team. From the command line: `cd android && ./gradlew assembleDebug` (output in `app/build/outputs/apk/debug/`).

## Changing things

- Screens: edit `frontend/src`, then `npm run android:sync`. Never edit `android/app/src/main/assets/public` (it's overwritten).
- Icon or splash: replace the PNGs in `frontend/assets/` and run `npm run android:icons`.
- App id and name: `frontend/capacitor.config.ts` (`app.kintsugi.circular`). Change the id before publishing to the Play Store.
- Permissions: `app/src/main/AndroidManifest.xml`.

## If the first build fails

- "SDK location not found": open the project once in Android Studio, or create `android/local.properties` with `sdk.dir=/path/to/Android/sdk`.
- Gradle JDK errors: in Android Studio set Settings → Build Tools → Gradle → Gradle JDK to the bundled JDK 21.
- "project ':capacitor-android' not found": run `npm install` in `frontend/` first.
