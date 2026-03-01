variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "db_password" {
  description = "Cloud SQL database password"
  type        = string
  sensitive   = true
}

variable "google_oauth_client_id" {
  description = "Google OAuth client ID for Firebase Auth"
  type        = string
}

variable "google_oauth_client_secret" {
  description = "Google OAuth client secret for Firebase Auth"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository (owner/repo format)"
  type        = string
}

variable "backend_image" {
  description = "Container image for Cloud Run backend"
  type        = string
}

variable "ai_gateway_api_key" {
  description = "Vercel AI Gateway API key"
  type        = string
  sensitive   = true
}

variable "deepgram_api_key" {
  description = "Deepgram API key for speech-to-text"
  type        = string
  sensitive   = true
}

variable "inworld_api_key" {
  description = "Inworld API key for TTS"
  type        = string
  sensitive   = true
}

variable "inworld_voice_id" {
  description = "Inworld voice ID"
  type        = string
  default     = "Dominus"
}

variable "inworld_tts_model_id" {
  description = "Inworld TTS model ID"
  type        = string
  default     = "inworld-tts-1.5-mini"
}

variable "composio_api_key" {
  description = "Composio API key for agent tools"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_ai_api_key" {
  description = "Google AI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "browser_use_api_key" {
  description = "Browser-use Cloud API key"
  type        = string
  sensitive   = true
  default     = ""
}
