#!/usr/bin/env bash
# One-time Google Cloud setup for Kintsugi. Run from the repo root:
#   PROJECT=your-project REGION=us-central1 ./infra/setup_gcp.sh
set -euo pipefail
: "${PROJECT:?set PROJECT}"
REGION="${REGION:-us-central1}"
BUCKET="${BUCKET:-${PROJECT}-kintsugi-uploads}"
EMBED_DIM="${EMBED_DIM:-768}"

gcloud config set project "$PROJECT"

echo "Enabling APIs..."
gcloud services enable \
  aiplatform.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com storage.googleapis.com \
  places.googleapis.com geocoding-backend.googleapis.com maps-backend.googleapis.com

echo "Creating Firestore (native mode) if missing..."
gcloud firestore databases describe --database="(default)" >/dev/null 2>&1 || \
  gcloud firestore databases create --location="$REGION" --type=firestore-native

echo "Creating the vector index on items.embedding (${EMBED_DIM} dims)..."
gcloud firestore indexes composite create --collection-group=items --query-scope=COLLECTION \
  --field-config="field-path=embedding,vector-config={\"dimension\":\"${EMBED_DIM}\",\"flat\":\"{}\"}" || true

echo "Creating the events index used by Mission control..."
gcloud firestore indexes composite create --collection-group=events --query-scope=COLLECTION \
  --field-config=field-path=job_id,order=ascending --field-config=field-path=ts,order=ascending || true

echo "Creating the uploads bucket gs://${BUCKET}..."
gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" --uniform-bucket-level-access

echo "Deleting raw uploads after 1 day (privacy: only blurred evidence is kept)..."
cat > /tmp/kintsugi-lifecycle.json <<'JSON'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 1, "matchesPrefix": ["uploads/"]}}]}
JSON
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file=/tmp/kintsugi-lifecycle.json

SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
echo "Granting the Cloud Run runtime account ($SA) access to Vertex AI, Firestore and the bucket..."
for role in roles/aiplatform.user roles/datastore.user; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${SA}" --role="$role" --condition=None >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" --member="serviceAccount:${SA}" --role=roles/storage.objectAdmin >/dev/null

cat <<MSG

Done. Next:
  1. Create two Maps keys in the console (APIs & Services → Credentials):
     - a server key restricted to Places API (New) + Geocoding API  → MAPS_API_KEY (backend)
     - a browser key restricted to Maps JavaScript API and your site → VITE_GOOGLE_MAPS_API_KEY (frontend)
  2. Create a Map ID with Advanced Markers (Google Maps Platform → Map management) → VITE_GOOGLE_MAP_ID
  3. Deploy: PROJECT=$PROJECT REGION=$REGION MAPS_API_KEY=... ./infra/deploy_backend.sh
MSG
