# Deploy EcoTrack with Google Auth
param(
    [Parameter(Mandatory=$true)][string]$GoogleClientId,
    [string]$ProjectId = "agentflow-prod-assistant",
    [string]$Region = "us-central1",
    [string]$ApiUrl = "https://carbon-footprint-api-pamlpivwwa-uc.a.run.app",
    [string]$FirebaseApiKey = "",
    [string]$FirebaseAuthDomain = "",
    [string]$FirebaseAppId = "",
    [string]$FirebaseMessagingSenderId = "",
    [string]$FirebaseStorageBucket = ""
)

$Registry = "${Region}-docker.pkg.dev/${ProjectId}/carbon-footprint"
$AuthEnabled = if ($FirebaseApiKey -and $FirebaseAppId) { "true" } else { "false" }

Write-Host "=== Deploying API ===" -ForegroundColor Cyan
Push-Location "$PSScriptRoot\..\..\backend"
gcloud builds submit --tag "${Registry}/carbon-footprint-api:latest" --project=$ProjectId --region=$Region
gcloud run deploy carbon-footprint-api `
    --image="${Registry}/carbon-footprint-api:latest" `
    --region=$Region --project=$ProjectId `
    --service-account="carbon-api-sa@${ProjectId}.iam.gserviceaccount.com" `
    --set-env-vars="GCP_PROJECT_ID=${ProjectId},GCP_REGION=${Region},NODE_ENV=production,BQ_DATASET=ecotrack_analytics,REPORTS_BUCKET=${ProjectId}-carbon-reports,PUBSUB_TOPIC=carbon-events,GOOGLE_CLIENT_ID=${GoogleClientId},ALLOW_GUEST_ACCESS=false,ALLOWED_ORIGINS=https://carbon-footprint-ui-pamlpivwwa-uc.a.run.app,http://localhost:5173"
Pop-Location

$ApiUrl = gcloud run services describe carbon-footprint-api --region=$Region --project=$ProjectId --format="value(status.url)"

Write-Host "=== Deploying UI ===" -ForegroundColor Cyan
Push-Location "$PSScriptRoot\..\..\frontend"
$subs = "_API_URL=$ApiUrl,_GOOGLE_CLIENT_ID=$GoogleClientId,_AUTH_ENABLED=$AuthEnabled"
if ($FirebaseApiKey) { $subs += ",_FIREBASE_API_KEY=$FirebaseApiKey,_FIREBASE_AUTH_DOMAIN=$FirebaseAuthDomain,_FIREBASE_APP_ID=$FirebaseAppId,_FIREBASE_MESSAGING_SENDER_ID=$FirebaseMessagingSenderId,_FIREBASE_STORAGE_BUCKET=$FirebaseStorageBucket" }
gcloud builds submit --config=cloudbuild-frontend.yaml --substitutions=$subs --project=$ProjectId --region=$Region
gcloud run deploy carbon-footprint-ui --image="${Registry}/carbon-footprint-ui:latest" --region=$Region --project=$ProjectId
Pop-Location

$UiUrl = gcloud run services describe carbon-footprint-ui --region=$Region --project=$ProjectId --format="value(status.url)"
Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "API: $ApiUrl"
Write-Host "UI:  $UiUrl"
Write-Host "Add authorized origin in OAuth client: $UiUrl"
