#!/usr/bin/env bash
# Deploy the API to Cloud Run (live mode). Run from the repo root:
#   PROJECT=... REGION=us-central1 MAPS_API_KEY=... ./infra/deploy_backend.sh
set -euo pipefail
: "${PROJECT:?set PROJECT}"
REGION="${REGION:-us-central1}"
BUCKET="${BUCKET:-${PROJECT}-kintsugi-uploads}"
MOCK_MODE="${MOCK_MODE:-false}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://${PROJECT}.web.app}"  # written into the A2A Agent Card

# min-instances=1 avoids cold starts while judges test; no-cpu-throttling keeps background agent jobs running.
gcloud run deploy kintsugi-api \
  --project "$PROJECT" --region "$REGION" --source backend \
  --allow-unauthenticated --min-instances 1 --max-instances 3 --no-cpu-throttling \
  --memory 1Gi --timeout 300 \
  --set-env-vars "MOCK_MODE=${MOCK_MODE},STORE=firestore,GCP_PROJECT=${PROJECT},GCP_LOCATION=${REGION},GCS_BUCKET=${BUCKET},MAPS_API_KEY=${MAPS_API_KEY:-},DEMO_STEP_DELAY=0.6,LIVE_MARKET=${LIVE_MARKET:-true},PUBLIC_BASE_URL=${PUBLIC_BASE_URL}"

gcloud run services describe kintsugi-api --project "$PROJECT" --region "$REGION" --format='value(status.url)'
