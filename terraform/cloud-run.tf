resource "google_cloud_run_v2_service" "game_server" {
  name                = "bossroom-game-server"
  location            = var.region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    timeout = "3600s"

    containers {
      image = var.backend_image

      ports {
        name           = "http1"
        container_port = 8080
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      # Database — Cloud SQL proxy via Unix socket
      env {
        name  = "DATABASE_URL"
        value = "postgresql://${google_sql_user.bossroom.name}:${var.db_password}@/bossroom?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      # Firebase Admin SDK
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "FIREBASE_CLIENT_EMAIL"
        value = google_service_account.firebase_admin.email
      }
      env {
        name  = "FIREBASE_PRIVATE_KEY"
        value = jsondecode(base64decode(google_service_account_key.firebase_admin.private_key)).private_key
      }

      # AI Gateway
      env {
        name  = "AI_GATEWAY_API_KEY"
        value = var.ai_gateway_api_key
      }

      # CORS — allow Cloudflare Pages origin
      env {
        name  = "ALLOWED_ORIGIN"
        value = "https://bossroom.pages.dev"
      }

      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }

      # Composio
      env {
        name  = "COMPOSIO_API_KEY"
        value = var.composio_api_key
      }

      # Deepgram STT
      env {
        name  = "DEEPGRAM_API_KEY"
        value = var.deepgram_api_key
      }

      # MiniMax TTS
      env {
        name  = "MINIMAX_API_KEY"
        value = var.minimax_api_key
      }
      env {
        name  = "MINIMAX_TTS_VOICE_ID"
        value = var.minimax_tts_voice_id
      }
      env {
        name  = "MINIMAX_TTS_MODEL"
        value = var.minimax_tts_model
      }

      # Google AI
      env {
        name  = "GOOGLE_AI_API_KEY"
        value = var.google_ai_api_key
      }

      # Browser-use Cloud API
      env {
        name  = "BROWSER_USE_API_KEY"
        value = var.browser_use_api_key
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.game_server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
