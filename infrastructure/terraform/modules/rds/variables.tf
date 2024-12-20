# MongoDB Atlas Project Configuration
variable "project_id" {
  description = "MongoDB Atlas project ID for tenant isolation"
  type        = string

  validation {
    condition     = length(var.project_id) > 0
    error_message = "Project ID must be provided"
  }
}

variable "environment" {
  description = "Deployment environment (dev/staging/prod) with specific configurations"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "cluster_name" {
  description = "Name of the MongoDB Atlas cluster following naming convention"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.cluster_name))
    error_message = "Cluster name must contain only alphanumeric characters and hyphens"
  }
}

# MongoDB Version and Instance Configuration
variable "mongo_db_major_version" {
  description = "MongoDB major version for compatibility and features"
  type        = string
  default     = "6.0"

  validation {
    condition     = can(regex("^[0-9]\\.[0-9]$", var.mongo_db_major_version))
    error_message = "MongoDB version must be in format X.Y"
  }
}

variable "provider_instance_size_name" {
  description = "Atlas instance size for performance requirements"
  type        = string
  default     = "M10"

  validation {
    condition     = can(regex("^M[0-9]+$", var.provider_instance_size_name))
    error_message = "Instance size must be a valid Atlas tier (e.g., M10, M20, etc.)"
  }
}

variable "provider_region_name" {
  description = "AWS region for MongoDB Atlas cluster deployment"
  type        = string
  default     = "US_EAST_1"

  validation {
    condition     = can(regex("^[A-Z_]+$", var.provider_region_name))
    error_message = "Region must be in uppercase with underscores"
  }
}

# Backup and Recovery Configuration
variable "backup_enabled" {
  description = "Enable continuous backup for data protection"
  type        = bool
  default     = true
}

variable "pit_enabled" {
  description = "Enable Point-in-Time Recovery for granular recovery options"
  type        = bool
  default     = true
}

# Performance and Storage Configuration
variable "provider_disk_iops" {
  description = "Disk IOPS for MongoDB Atlas cluster performance"
  type        = number
  default     = 3000

  validation {
    condition     = var.provider_disk_iops >= 1000
    error_message = "Disk IOPS must be at least 1000"
  }
}

variable "provider_volume_type" {
  description = "Volume type for MongoDB Atlas cluster storage"
  type        = string
  default     = "STANDARD"
}

variable "provider_encrypt_ebs_volume" {
  description = "Enable EBS volume encryption for data security"
  type        = bool
  default     = true
}

variable "auto_scaling_disk_gb_enabled" {
  description = "Enable disk auto-scaling for dynamic storage management"
  type        = bool
  default     = true
}

variable "disk_size_gb" {
  description = "Initial disk size in GB for storage allocation"
  type        = number
  default     = 100

  validation {
    condition     = var.disk_size_gb >= 10
    error_message = "Disk size must be at least 10 GB"
  }
}

# Security Configuration
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the cluster for security"
  type        = list(string)

  validation {
    condition     = alltrue([for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))])
    error_message = "All CIDR blocks must be in valid format"
  }
}