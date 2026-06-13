# Full deployment script for Carbon Footprint Platform
param(
    [string]$ProjectId = "agentflow-prod-assistant",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"
$REPO = "carbon-footprint"
$REGISTRY = "${Region}-docker.pkg.dev/${ProjectId}/${REPO}"

Write-Host "=== Deploying Carbon Footprint Platform ===" -ForegroundColor Cyan

# Build and push backend
Write-Host "Building backend..."
Push-Location "$PSScriptRoot\..\..\backend"
gcloud builds submit --tag "${REGISTRY}/carbon-footprint-api:latest" --project=$ProjectId --region=$Region
Pop-Location

# Deploy backend to Cloud Run
Write-Host "Deploying carbon-footprint-api..."
gcloud run deploy carbon-footprint-api `
    --image="${REGISTRY}/carbon-footprint-api:latest" `
    --region=$Region `
    --project=$ProjectId `
    --platform=managed `
    --allow-unauthenticated `
    --service-account="carbon-api-sa@${ProjectId}.iam.gserviceaccount.com" `
    --set-env-vars="GCP_PROJECT_ID=${ProjectId},GCP_REGION=${Region},NODE_ENV=production,BQ_DATASET=ecotrack_analytics,REPORTS_BUCKET=${ProjectId}-carbon-reports,PUBSUB_TOPIC=carbon-events" `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=10 `
    --port=8080

$API_URL = gcloud run services describe carbon-footprint-api --region=$Region --project=$ProjectId --format="value(status.url)"

# Build and push frontend
Write-Host "Building frontend..."
Push-Location "$PSScriptRoot\..\..\frontend"
gcloud builds submit --config=cloudbuild-frontend.yaml --substitutions="_API_URL=${API_URL}" --project=$ProjectId --region=$Region
Pop-Location

# Deploy frontend to Cloud Run
Write-Host "Deploying carbon-footprint-ui..."
gcloud run deploy carbon-footprint-ui `
    --image="${REGISTRY}/carbon-footprint-ui:latest" `
    --region=$Region `
    --project=$ProjectId `
    --platform=managed `
    --allow-unauthenticated `
    --memory=256Mi `
    --port=8080

$UI_URL = gcloud run services describe carbon-footprint-ui --region=$Region --project=$ProjectId --format="value(status.url)"

# Update backend CORS
gcloud run services update carbon-footprint-api `
    --region=$Region `
    --project=$ProjectId `
    --update-env-vars="ALLOWED_ORIGINS=${UI_URL},http://localhost:5173"

# Deploy Cloud Function
Write-Host "Deploying carbon-processor function..."
Push-Location "$PSScriptRoot\..\..\functions\carbon-processor"
gcloud functions deploy carbon-processor `
    --gen2 `
    --runtime=nodejs20 `
    --region=$Region `
    --project=$ProjectId `
    --source=. `
    --entry-point=processCarbonEvent `
    --trigger-topic=carbon-events `
    --service-account="carbon-fn-sa@${ProjectId}.iam.gserviceaccount.com" `
    --set-env-vars="GCP_PROJECT_ID=${ProjectId},GCP_REGION=${Region},BQ_DATASET=ecotrack_analytics" `
    --memory=256Mi
Pop-Location

Write-Host ""
Write-Host "=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
Write-Host "API URL:  $API_URL"
Write-Host "UI URL:   $UI_URL"
Write-Host "Health:   $API_URL/health"
