#!/usr/bin/env bash
# Build the web app and deploy it to Firebase Hosting. /api is rewritten to the Cloud Run
# service (see firebase.json), so the app and API share one origin and no CORS is needed.
#   PROJECT=... ./infra/deploy_frontend.sh   (frontend/.env.local holds the browser Maps key)
set -euo pipefail
: "${PROJECT:?set PROJECT}"
(cd frontend && npm ci && npm run build)
npx firebase-tools deploy --only hosting --project "$PROJECT"
