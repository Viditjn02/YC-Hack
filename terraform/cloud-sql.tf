resource "google_sql_database_instance" "main" {
  name                = "bossroom-db"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = false

  settings {
    tier = "db-f1-micro"

    ip_configuration {
      ipv4_enabled    = true
      authorized_networks {
        name  = "allow-all"
        value = "0.0.0.0/0"
      }
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "bossroom" {
  name     = "bossroom"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "bossroom" {
  name     = "bossroom"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
