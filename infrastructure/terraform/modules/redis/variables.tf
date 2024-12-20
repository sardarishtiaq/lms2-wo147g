# Redis Module Variables
# Version: 1.0.0
# Redis Enterprise: 7.x

# Required Variables

variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod)"
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "cluster_name" {
  type        = string
  description = "Name of the Redis cluster"
  
  validation {
    condition     = length(var.cluster_name) <= 40
    error_message = "Cluster name cannot exceed 40 characters."
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where Redis cluster will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for Redis cluster deployment"
}

# Optional Variables with Defaults

variable "node_type" {
  type        = string
  description = "Instance type for Redis nodes"
  default     = "cache.t3.medium"
}

variable "num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the cluster"
  default     = 2
}

variable "port" {
  type        = number
  description = "Port number for Redis cluster"
  default     = 6379
}

variable "engine_version" {
  type        = string
  description = "Redis engine version"
  default     = "7.0"
}

variable "parameter_group_family" {
  type        = string
  description = "Redis parameter group family"
  default     = "redis7"
}

variable "maintenance_window" {
  type        = string
  description = "Maintenance window for Redis cluster"
  default     = "sun:05:00-sun:06:00"
}

variable "snapshot_window" {
  type        = string
  description = "Time window for Redis snapshot"
  default     = "04:00-05:00"
}

variable "snapshot_retention_limit" {
  type        = number
  description = "Number of days to retain Redis snapshots"
  default     = 7
}

variable "multi_az_enabled" {
  type        = bool
  description = "Enable Multi-AZ deployment for Redis cluster"
  default     = true
}

variable "auto_minor_version_upgrade" {
  type        = bool
  description = "Enable automatic minor version upgrades"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to Redis resources"
  default     = {}
}