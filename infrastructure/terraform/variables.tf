# Environment Configuration
variable "environment" {
  description = "Deployment environment (development/staging/production) with specific resource configurations"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# AWS Region Configuration
variable "aws_region" {
  description = "AWS region for resource deployment with multi-region failover capability"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "AWS region must be in the format: us-east-1, eu-west-1, etc."
  }
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC with subnet allocation strategy"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# EKS Cluster Configuration
variable "eks_cluster_config" {
  description = "Comprehensive EKS cluster configuration including node groups, scaling, and security"
  type = object({
    cluster_version    = string
    node_instance_types = list(string)
    min_nodes         = number
    max_nodes         = number
    desired_nodes     = number
    availability_zones = list(string)
    node_labels       = map(string)
    node_taints       = list(object({
      key    = string
      value  = string
      effect = string
    }))
    cluster_logging    = list(string)
    cluster_encryption = bool
  })

  default = {
    cluster_version    = "1.27"
    node_instance_types = ["t3.large", "t3.xlarge"]
    min_nodes         = 2
    max_nodes         = 10
    desired_nodes     = 3
    availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
    node_labels       = {
      role        = "application"
      environment = "production"
    }
    node_taints       = []
    cluster_logging    = ["api", "audit", "authenticator"]
    cluster_encryption = true
  }

  validation {
    condition     = length(var.eks_cluster_config.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }
}

# MongoDB Atlas Configuration
variable "mongodb_config" {
  description = "MongoDB Atlas cluster configuration with high availability and security settings"
  type = object({
    instance_class        = string
    version              = string
    backup_retention_days = number
    instance_count       = number
    auto_scaling_enabled = bool
    disk_size_gb        = number
    encryption_at_rest   = bool
    backup_window       = string
    maintenance_window  = string
    alert_configurations = list(object({
      type      = string
      threshold = number
      enabled   = bool
    }))
  })

  default = {
    instance_class        = "M30"
    version              = "6.0"
    backup_retention_days = 7
    instance_count       = 3
    auto_scaling_enabled = true
    disk_size_gb        = 100
    encryption_at_rest   = true
    backup_window       = "03:00-05:00"
    maintenance_window  = "tue:03:00-tue:05:00"
    alert_configurations = []
  }

  validation {
    condition     = var.mongodb_config.instance_count >= 3
    error_message = "MongoDB cluster must have at least 3 instances for high availability."
  }
}

# Redis Enterprise Configuration
variable "redis_config" {
  description = "Redis Enterprise cluster configuration for caching and session management"
  type = object({
    node_type                = string
    num_cache_nodes         = number
    parameter_group_family  = string
    automatic_failover      = bool
    multi_az               = bool
    transit_encryption     = bool
    at_rest_encryption     = bool
    snapshot_retention_limit = number
    snapshot_window        = string
  })

  default = {
    node_type                = "cache.r6g.large"
    num_cache_nodes         = 3
    parameter_group_family  = "redis7"
    automatic_failover      = true
    multi_az               = true
    transit_encryption     = true
    at_rest_encryption     = true
    snapshot_retention_limit = 7
    snapshot_window        = "03:00-05:00"
  }

  validation {
    condition     = var.redis_config.num_cache_nodes >= 3
    error_message = "Redis cluster must have at least 3 nodes for high availability."
  }
}

# S3 Storage Configuration
variable "s3_config" {
  description = "S3 storage configuration with compliance and lifecycle management"
  type = object({
    versioning          = bool
    encryption          = bool
    lifecycle_rules     = map(any)
    cors_rules          = list(object({
      allowed_headers = list(string)
      allowed_methods = list(string)
      allowed_origins = list(string)
      max_age_seconds = number
    }))
    logging             = bool
    public_access_block = bool
    replication_enabled = bool
    object_lock_enabled = bool
  })

  default = {
    versioning          = true
    encryption          = true
    lifecycle_rules     = {
      transition_glacier_days = 90
      expiration_days       = 365
    }
    cors_rules          = []
    logging             = true
    public_access_block = true
    replication_enabled = true
    object_lock_enabled = true
  }
}

# Resource Tagging Configuration
variable "tags" {
  description = "Common tags for resource management and cost allocation"
  type        = map(string)
  default     = {
    Project          = "CRM"
    ManagedBy        = "Terraform"
    Environment      = "production"
    Owner            = "DevOps"
    SecurityLevel    = "high"
    ComplianceLevel  = "pci-dss"
  }

  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "SecurityLevel")
    error_message = "Tags must include Environment and SecurityLevel keys."
  }
}