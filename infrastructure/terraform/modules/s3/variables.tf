# Project Identification
variable "project_name" {
  description = "Name of the project used in bucket naming and resource identification"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "Project name must be lowercase alphanumeric with hyphens only, starting and ending with alphanumeric character."
  }

  validation {
    condition     = length(var.project_name) >= 3 && length(var.project_name) <= 63
    error_message = "Project name must be between 3 and 63 characters."
  }
}

# Environment Configuration
variable "environment" {
  description = "Deployment environment for resource segregation and configuration"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }

  validation {
    condition     = lower(var.environment) == var.environment
    error_message = "Environment name must be lowercase."
  }
}

# Bucket Management
variable "force_destroy" {
  description = "Safety flag for bucket deletion with content. Set to true to allow bucket deletion even when not empty."
  type        = bool
  default     = false

  validation {
    condition     = var.environment != "production" || var.force_destroy == false
    error_message = "Force destroy must be explicitly set to false for production environments."
  }
}

# Versioning Configuration
variable "versioning_enabled" {
  description = "Enable versioning for document and backup storage. Required for production environments."
  type        = bool
  default     = true

  validation {
    condition     = var.environment != "production" || var.versioning_enabled == true
    error_message = "Versioning must be enabled for production environments."
  }
}

# Lifecycle Management
variable "backup_retention_days" {
  description = "Number of days before transitioning objects to STANDARD_IA storage class"
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 30 && var.backup_retention_days <= 90
    error_message = "Backup retention days must be between 30 and 90 days."
  }
}

variable "backup_expiration_days" {
  description = "Number of days before backup objects are permanently deleted"
  type        = number
  default     = 365

  validation {
    condition     = var.backup_expiration_days > var.backup_retention_days
    error_message = "Backup expiration days must be greater than backup retention days."
  }

  validation {
    condition     = var.environment != "production" || var.backup_expiration_days >= 365
    error_message = "Backup expiration must be at least 365 days for production environments."
  }
}

# Security Configuration
variable "encryption_algorithm" {
  description = "Server-side encryption algorithm for data protection"
  type        = string
  default     = "AES256"

  validation {
    condition     = contains(["AES256", "aws:kms"], var.encryption_algorithm)
    error_message = "Encryption algorithm must be one of: AES256, aws:kms."
  }

  validation {
    condition     = var.environment != "production" || var.encryption_algorithm == "aws:kms"
    error_message = "KMS encryption (aws:kms) is required for production environments."
  }
}

# Resource Tagging
variable "tags" {
  description = "Resource tags for bucket management and cost allocation"
  type        = map(string)
  default     = {}

  validation {
    condition     = contains(keys(var.tags), "environment")
    error_message = "Tags must include an 'environment' tag."
  }

  validation {
    condition     = contains(keys(var.tags), "owner")
    error_message = "Tags must include an 'owner' tag."
  }

  validation {
    condition     = contains(keys(var.tags), "cost-center")
    error_message = "Tags must include a 'cost-center' tag."
  }
}