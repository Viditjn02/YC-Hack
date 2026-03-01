resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_identity_platform_config" "default" {
  provider = google-beta
  project  = var.project_id

  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
    "${cloudflare_pages_project.frontend.name}.pages.dev",
  ]

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }
  }

  depends_on = [google_firebase_project.default]
}

resource "google_identity_platform_default_supported_idp_config" "google" {
  provider      = google-beta
  project       = var.project_id
  idp_id        = "google.com"
  enabled       = true
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret

  depends_on = [google_identity_platform_config.default]
}

resource "google_firebase_web_app" "default" {
  provider     = google-beta
  project      = var.project_id
  display_name = "BossRoom Web App"

  depends_on = [google_firebase_project.default]
}

data "google_firebase_web_app_config" "default" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.default.app_id
}

# --- Firebase Admin SDK service account ---
resource "google_service_account" "firebase_admin" {
  project      = var.project_id
  account_id   = "firebase-admin-sdk"
  display_name = "Firebase Admin SDK"
  description  = "Service account for server-side Firebase Auth token verification"

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "firebase_admin_role" {
  project = var.project_id
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.firebase_admin.email}"
}

resource "google_service_account_key" "firebase_admin" {
  service_account_id = google_service_account.firebase_admin.name
}
