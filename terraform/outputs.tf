output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.game_server.uri
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name"
  value       = google_sql_database_instance.main.connection_name
}

output "cloud_sql_connection_string" {
  description = "Cloud SQL connection string"
  value       = "postgresql://${google_sql_user.bossroom.name}:${var.db_password}@/${google_sql_database.bossroom.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
  sensitive   = true
}

output "firebase_config" {
  description = "Firebase web app configuration"
  value = {
    apiKey      = data.google_firebase_web_app_config.default.api_key
    authDomain  = data.google_firebase_web_app_config.default.auth_domain
    projectId   = var.project_id
    appId       = google_firebase_web_app.default.app_id
  }
  sensitive = true
}

output "firebase_admin_credentials" {
  description = "Firebase Admin SDK service account credentials"
  value = {
    projectId   = var.project_id
    clientEmail = google_service_account.firebase_admin.email
    privateKey  = jsondecode(base64decode(google_service_account_key.firebase_admin.private_key))["private_key"]
  }
  sensitive = true
}

output "cloudflare_url" {
  description = "Cloudflare Pages project URL"
  value       = "https://${cloudflare_pages_project.frontend.name}.pages.dev"
}
