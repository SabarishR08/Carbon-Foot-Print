# GCP Resource Provisioning for Carbon Footprint Platform
param(
    [string]$ProjectId = "agentflow-prod-assistant",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"
$env:PROJECT_ID = $ProjectId
$env:REGION = $Region

Write-Host "=== Provisioning GCP resources for $ProjectId ===" -ForegroundColor Cyan

$APIS = @(
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "pubsub.googleapis.com",
    "cloudfunctions.googleapis.com",
    "eventarc.googleapis.com",
    "cloudtasks.googleapis.com",
    "cloudscheduler.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firebase.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudtrace.googleapis.com",
    "iam.googleapis.com"
)

foreach ($api in $APIS) {
    Write-Host "Enabling $api..."
    gcloud services enable $api --project=$ProjectId 2>$null
}

Write-Host "Creating Firestore database..."
gcloud firestore databases create --location=$Region --project=$ProjectId 2>$null

Write-Host "Creating Pub/Sub topic..."
gcloud pubsub topics create carbon-events --project=$ProjectId 2>$null

Write-Host "Creating GCS buckets..."
gcloud storage buckets create "gs://${ProjectId}-carbon-reports" --location=$Region --project=$ProjectId 2>$null
gcloud storage buckets create "gs://${ProjectId}-cloudbuild" --location=$Region --project=$ProjectId 2>$null

Write-Host "Creating Artifact Registry..."
gcloud artifacts repositories create carbon-footprint `
    --repository-format=docker `
    --location=$Region `
    --project=$ProjectId 2>$null

Write-Host "Creating service accounts..."
$SA_API = "carbon-api-sa"
$SA_FN = "carbon-fn-sa"
gcloud iam service-accounts create $SA_API --display-name="Carbon API Service Account" --project=$ProjectId 2>$null
gcloud iam service-accounts create $SA_FN --display-name="Carbon Functions SA" --project=$ProjectId 2>$null

$SA_API_EMAIL = "${SA_API}@${ProjectId}.iam.gserviceaccount.com"
$SA_FN_EMAIL = "${SA_FN}@${ProjectId}.iam.gserviceaccount.com"

$ROLES = @(
    "roles/datastore.user",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/pubsub.publisher",
    "roles/storage.objectAdmin",
    "roles/aiplatform.user",
    "roles/secretmanager.secretAccessor",
    "roles/cloudtrace.agent",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter"
)

foreach ($role in $ROLES) {
    gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$SA_API_EMAIL" --role=$role --quiet 2>$null
}

$FN_ROLES = @("roles/datastore.user", "roles/bigquery.dataEditor", "roles/aiplatform.user", "roles/pubsub.subscriber")
foreach ($role in $FN_ROLES) {
    gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$SA_FN_EMAIL" --role=$role --quiet 2>$null
}

Write-Host "Creating BigQuery dataset and tables..."
$BQ_SCRIPT = @"
CREATE SCHEMA IF NOT EXISTS ecotrack_analytics OPTIONS(location='US');
CREATE TABLE IF NOT EXISTS ecotrack_analytics.carbon_usage (
  id STRING, user_id STRING, category STRING, subtype STRING,
  co2e_kg FLOAT64, value FLOAT64, unit STRING, recorded_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ecotrack_analytics.user_activity (
  user_id STRING, action STRING, metadata STRING, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ecotrack_analytics.ai_recommendations (
  user_id STRING, insight_type STRING, content STRING, created_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ecotrack_analytics.emissions_trends (
  user_id STRING, week_start DATE, total_co2e_kg FLOAT64,
  transport_kg FLOAT64, food_kg FLOAT64, energy_kg FLOAT64,
  water_kg FLOAT64, waste_kg FLOAT64, shopping_kg FLOAT64
);
"@

$BQ_SCRIPT | bq query --use_legacy_sql=false --project_id=$ProjectId 2>$null

Write-Host "Creating Cloud Scheduler job for weekly reports..."
gcloud scheduler jobs create pubsub weekly-carbon-report `
    --location=$Region `
    --schedule="0 9 * * 1" `
    --topic=carbon-events `
    --message-body='{"eventType":"scheduler.weekly_report","timestamp":"auto"}' `
    --project=$ProjectId 2>$null

Write-Host "=== GCP setup complete ===" -ForegroundColor Green
