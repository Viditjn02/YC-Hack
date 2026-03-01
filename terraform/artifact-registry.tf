resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = "bossroom"
  format        = "DOCKER"
  description   = "Docker images for BossBot game server"

  depends_on = [google_project_service.apis]
}
