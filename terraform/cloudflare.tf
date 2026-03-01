resource "cloudflare_pages_project" "frontend" {
  account_id        = var.cloudflare_account_id
  name              = "bossroom"
  production_branch = "main"

  build_config = {
    build_command   = "npx nx build game-frontend --configuration=production"
    destination_dir = "apps/game-frontend/out"
  }

  deployment_configs = {
    preview = {
      env_vars = {
        NEXT_PUBLIC_FIREBASE_API_KEY = {
          type  = "plain_text"
          value = data.google_firebase_web_app_config.default.api_key
        }
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = {
          type  = "plain_text"
          value = data.google_firebase_web_app_config.default.auth_domain
        }
        NEXT_PUBLIC_FIREBASE_PROJECT_ID = {
          type  = "plain_text"
          value = var.project_id
        }
        NEXT_PUBLIC_FIREBASE_APP_ID = {
          type  = "plain_text"
          value = google_firebase_web_app.default.app_id
        }
        NEXT_PUBLIC_BACKEND_URL = {
          type  = "plain_text"
          value = google_cloud_run_v2_service.game_server.uri
        }
        NEXT_PUBLIC_WS_URL = {
          type  = "plain_text"
          value = replace(google_cloud_run_v2_service.game_server.uri, "https://", "wss://")
        }
        NEXT_PUBLIC_SERVER_HTTP_URL = {
          type  = "plain_text"
          value = google_cloud_run_v2_service.game_server.uri
        }
        NEXT_PUBLIC_VOICE_ENABLED = {
          type  = "plain_text"
          value = "true"
        }
      }
    }

    production = {
      env_vars = {
        NEXT_PUBLIC_FIREBASE_API_KEY = {
          type  = "plain_text"
          value = data.google_firebase_web_app_config.default.api_key
        }
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = {
          type  = "plain_text"
          value = data.google_firebase_web_app_config.default.auth_domain
        }
        NEXT_PUBLIC_FIREBASE_PROJECT_ID = {
          type  = "plain_text"
          value = var.project_id
        }
        NEXT_PUBLIC_FIREBASE_APP_ID = {
          type  = "plain_text"
          value = google_firebase_web_app.default.app_id
        }
        NEXT_PUBLIC_BACKEND_URL = {
          type  = "plain_text"
          value = google_cloud_run_v2_service.game_server.uri
        }
        NEXT_PUBLIC_WS_URL = {
          type  = "plain_text"
          value = replace(google_cloud_run_v2_service.game_server.uri, "https://", "wss://")
        }
        NEXT_PUBLIC_SERVER_HTTP_URL = {
          type  = "plain_text"
          value = google_cloud_run_v2_service.game_server.uri
        }
        NEXT_PUBLIC_VOICE_ENABLED = {
          type  = "plain_text"
          value = "true"
        }
      }
    }
  }
}
