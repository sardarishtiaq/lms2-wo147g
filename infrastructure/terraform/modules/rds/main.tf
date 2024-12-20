# MongoDB Atlas Provider Configuration
# Version: ~> 1.10.0
terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.10.0"
    }
  }
}

# MongoDB Atlas Cluster Configuration
resource "mongodbatlas_cluster" "main" {
  project_id   = var.project_id
  name         = var.cluster_name
  cluster_type = "REPLICASET"

  # MongoDB Version and Provider Settings
  mongo_db_major_version = var.mongo_db_major_version
  provider_name         = "AWS"
  
  # Instance Configuration
  provider_instance_size_name = var.provider_instance_size_name
  provider_region_name       = var.provider_region_name

  # Backup Configuration
  backup_enabled = var.backup_enabled
  pit_enabled    = var.pit_enabled

  # Storage Configuration
  provider_disk_iops            = var.provider_disk_iops
  provider_volume_type         = var.provider_volume_type
  provider_encrypt_ebs_volume  = var.provider_encrypt_ebs_volume
  auto_scaling_disk_gb_enabled = var.auto_scaling_disk_gb_enabled
  disk_size_gb                = var.disk_size_gb

  # Replication Configuration
  replication_specs {
    num_shards = 1
    
    regions_config {
      region_name     = var.provider_region_name
      electable_nodes = 3
      priority        = 7
      read_only_nodes = 0
      analytics_nodes = 0
    }
  }

  # Advanced Security Configuration
  advanced_configuration {
    javascript_enabled            = false
    minimum_enabled_tls_protocol = "TLS1_2"
    no_table_scan               = false
    oplog_size_mb              = 2048
    sample_size_bi_connector    = 5000
    sample_refresh_interval_bi_connector = 300
  }

  # Labels for Resource Management
  labels {
    key   = "environment"
    value = var.environment
  }

  # Bi-Connector Configuration
  bi_connector_config {
    enabled         = true
    read_preference = "secondary"
  }
}

# IP Access List Configuration
resource "mongodbatlas_project_ip_access_list" "ip_access_list" {
  project_id = var.project_id
  cidr_block = var.allowed_cidr_blocks
  comment    = "CIDR block for ${var.environment} environment"
}

# Database User Configuration
resource "mongodbatlas_database_user" "main" {
  project_id         = var.project_id
  auth_database_name = "admin"
  username          = "mongodb-${var.environment}-user"
  
  # Role-based Access Control
  roles {
    role_name     = "readWrite"
    database_name = "${var.cluster_name}-${var.environment}"
  }

  roles {
    role_name     = "clusterMonitor"
    database_name = "admin"
  }

  # Scopes for Resource Access
  scopes {
    name = mongodbatlas_cluster.main.name
    type = "CLUSTER"
  }
}

# Auditing Configuration
resource "mongodbatlas_auditing" "main" {
  project_id                  = var.project_id
  audit_filter               = "{}"
  enabled                    = true
  audit_authorization_success = true
}

# Encryption at Rest Configuration
resource "mongodbatlas_encryption_at_rest" "main" {
  project_id = var.project_id

  aws_kms_config {
    enabled                = true
    customer_master_key_id = "aws-kms-key-id"
    region                = var.provider_region_name
  }
}

# Alert Configuration for Monitoring
resource "mongodbatlas_alert_configuration" "cluster_monitoring" {
  project_id = var.project_id
  
  event_type = "OUTSIDE_METRIC_THRESHOLD"
  enabled    = true

  metric_threshold_config {
    metric_name = "CONNECTIONS"
    operator    = "GREATER_THAN"
    threshold   = 50000
    units       = "RAW"
    mode       = "AVERAGE"
  }

  notification {
    type_name     = "EMAIL"
    delay_min     = 0
    interval_min  = 5
    email_enabled = true
  }
}

# Outputs for dependent modules
output "cluster_connection_strings" {
  description = "Connection strings for the MongoDB cluster"
  value       = mongodbatlas_cluster.main.connection_strings
  sensitive   = true
}

output "cluster_id" {
  description = "The ID of the MongoDB cluster"
  value       = mongodbatlas_cluster.main.cluster_id
}

output "cluster_state" {
  description = "Current state of the MongoDB cluster"
  value       = mongodbatlas_cluster.main.state_name
}