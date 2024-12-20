# Backend Configuration for Multi-tenant CRM Infrastructure
# Version: 1.0.0
# Provider Requirements: AWS Provider >= 4.0.0, Terraform >= 1.0.0

terraform {
  backend "s3" {
    # S3 bucket for state storage with environment-specific naming
    bucket = "${var.project_name}-terraform-state-${var.environment}"
    key    = "terraform.tfstate"
    region = var.aws_region

    # Enable encryption at rest using AWS KMS
    encrypt = true
    kms_key_id = "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:key/${var.kms_key_id}"

    # DynamoDB table for state locking
    dynamodb_table = "${var.project_name}-terraform-locks-${var.environment}"

    # Enable workspace support for multiple deployment configurations
    workspace_key_prefix = "workspaces"

    # Additional security configurations
    acl                  = "private"
    force_destroy        = false
    
    # Enable versioning for state file history
    versioning = true

    # Server-side encryption configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "aws:kms"
        }
      }
    }

    # Lifecycle rules for state management
    lifecycle_rule {
      enabled = true

      transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }

      noncurrent_version_transition {
        days          = 60
        storage_class = "GLACIER"
      }

      noncurrent_version_expiration {
        days = 90
      }
    }

    # Access logging configuration
    logging {
      target_bucket = "${var.project_name}-terraform-logs-${var.environment}"
      target_prefix = "terraform-state-access-logs/"
    }
  }

  # Required providers configuration
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0.0"
    }
  }

  # Minimum Terraform version requirement
  required_version = ">= 1.0.0"
}

# Data source for current AWS caller identity
data "aws_caller_identity" "current" {}

# Backend configuration validation
locals {
  backend_validation = {
    environment_valid = contains(["development", "staging", "production"], var.environment)
    region_valid     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
  }

  # Ensure backend configuration is valid
  validate_backend = {
    environment_check = local.backend_validation.environment_valid ? true : file("ERROR: Invalid environment specified")
    region_check     = local.backend_validation.region_valid ? true : file("ERROR: Invalid AWS region format")
  }
}

# Tags for backend resources
locals {
  backend_tags = merge(var.tags, {
    Component     = "Terraform Backend"
    ResourceType  = "State Management"
    LastModified  = timestamp()
    BackendType   = "S3"
    StateVersion  = "1.0"
  })
}