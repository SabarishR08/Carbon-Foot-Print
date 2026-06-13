terraform {
  required_version = ">= 1.3.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type        = string
  description = "The GCP Project ID"
  default     = "agentflow-prod-assistant"
}

variable "region" {
  type        = string
  description = "The target GCP region"
  default     = "us-central1"
}

# ─── APIs ───────────────────────────────────────────────────────────────────
locals {
  apis = [
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
    "storage-api.googleapis.com",
    "aiplatform.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com"
  ]
}

resource "google_project_service" "apis" {
  for_each           = toset(locals.apis)
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# ─── Storage Bucket ────────────────────────────────────────────────────────
resource "google_storage_bucket" "reports" {
  name          = "${var.project_id}-carbon-reports-tf"
  location      = var.region
  force_destroy = true
  depends_on    = [google_project_service.apis]
}

# ─── Artifact Registry ─────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "carbon-footprint"
  description   = "Docker repository for Carbon Footprint platform"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

# ─── Pub/Sub Topic ──────────────────────────────────────────────────────────
resource "google_pubsub_topic" "events" {
  name       = "carbon-events"
  project    = var.project_id
  depends_on = [google_project_service.apis]
}

# ─── BigQuery Dataset ──────────────────────────────────────────────────────
resource "google_bigquery_dataset" "analytics" {
  dataset_id  = "ecotrack_analytics"
  description = "Dataset for EcoTrack carbon usage statistics and analytical aggregates"
  location    = "US"
  depends_on  = [google_project_service.apis]
}

# ─── Service Account ────────────────────────────────────────────────────────
resource "google_service_account" "api_sa" {
  account_id   = "carbon-api-sa"
  display_name = "Carbon API Service Account"
  depends_on   = [google_project_service.apis]
}

resource "google_project_iam_member" "roles" {
  for_each = toset([
    "roles/datastore.user",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/pubsub.publisher",
    "roles/storage.objectAdmin",
    "roles/aiplatform.user",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter"
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}
