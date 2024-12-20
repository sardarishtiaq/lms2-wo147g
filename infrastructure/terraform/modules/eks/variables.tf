# EKS Cluster Configuration Variables
variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must start with a letter and can only contain letters, numbers, and hyphens."
  }

  validation {
    condition     = length(var.cluster_name) >= 1 && length(var.cluster_name) <= 100
    error_message = "Cluster name must be between 1 and 100 characters."
  }
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.27"

  validation {
    condition     = can(regex("^1\\.(25|26|27)$", var.cluster_version))
    error_message = "Cluster version must be one of: 1.25, 1.26, 1.27."
  }
}

# Networking Configuration Variables
variable "vpc_id" {
  description = "ID of the VPC where the EKS cluster will be deployed"
  type        = string

  validation {
    condition     = can(regex("^vpc-[a-z0-9]{8,}$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC ID (vpc-xxxxxxxx)."
  }
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for EKS node groups"
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets in different availability zones are required."
  }

  validation {
    condition     = can([for id in var.private_subnet_ids : regex("^subnet-[a-z0-9]{8,}$", id)])
    error_message = "All subnet IDs must be valid AWS subnet IDs (subnet-xxxxxxxx)."
  }
}

# Node Group Configuration Variables
variable "node_groups" {
  description = "Map of EKS node group configurations"
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    min_size      = number
    max_size      = number
    capacity_type = string
  }))

  default = {
    api = {
      instance_types = ["t3.large"]
      desired_size   = 2
      min_size      = 2
      max_size      = 4
      capacity_type = "ON_DEMAND"
    }
    worker = {
      instance_types = ["t3.xlarge"]
      desired_size   = 3
      min_size      = 2
      max_size      = 6
      capacity_type = "SPOT"
    }
  }

  validation {
    condition = alltrue([
      for ng in var.node_groups : (
        ng.min_size <= ng.desired_size &&
        ng.desired_size <= ng.max_size &&
        ng.capacity_type == "ON_DEMAND" || ng.capacity_type == "SPOT"
      )
    ])
    error_message = "Invalid node group configuration. Check size constraints and capacity type."
  }
}

# Security Configuration Variables
variable "enable_private_access" {
  description = "Enable private API server endpoint access"
  type        = bool
  default     = true
}

variable "enable_public_access" {
  description = "Enable public API server endpoint access"
  type        = bool
  default     = false
}

variable "public_access_cidrs" {
  description = "List of CIDR blocks allowed to access the public API server endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]

  validation {
    condition = alltrue([
      for cidr in var.public_access_cidrs : can(cidrhost(cidr, 0))
    ])
    error_message = "All values must be valid CIDR blocks."
  }
}

# Encryption Configuration Variables
variable "enable_cluster_encryption" {
  description = "Enable envelope encryption for cluster secrets using KMS"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "ARN of KMS key for cluster encryption"
  type        = string
  default     = null

  validation {
    condition     = var.kms_key_arn == null || can(regex("^arn:aws:kms:[a-z0-9-]+:[0-9]{12}:key/[a-zA-Z0-9-]+$", var.kms_key_arn))
    error_message = "KMS key ARN must be a valid AWS KMS key ARN."
  }
}

# Logging Configuration Variables
variable "cluster_logging_types" {
  description = "List of control plane logging types to enable"
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  validation {
    condition = alltrue([
      for type in var.cluster_logging_types :
      contains(["api", "audit", "authenticator", "controllerManager", "scheduler"], type)
    ])
    error_message = "Invalid logging type specified. Must be one of: api, audit, authenticator, controllerManager, scheduler."
  }
}

# Tagging Configuration Variables
variable "tags" {
  description = "Tags to be applied to all EKS resources"
  type        = map(string)
  default = {
    Project               = "CRM"
    ManagedBy            = "Terraform"
    Component            = "EKS"
    Environment          = "Production"
    CostCenter           = "IT-Infrastructure"
    SecurityClassification = "Confidential"
    ComplianceScope      = "GDPR-SOC2"
  }

  validation {
    condition     = length(var.tags) > 0
    error_message = "At least one tag must be specified."
  }
}

# Compliance Configuration Variables
variable "compliance_requirements" {
  description = "Map of compliance requirements to enable"
  type = object({
    enable_pod_security_policy = bool
    enable_network_policy     = bool
    enable_audit_logging      = bool
    enable_secrets_encryption = bool
  })
  default = {
    enable_pod_security_policy = true
    enable_network_policy     = true
    enable_audit_logging      = true
    enable_secrets_encryption = true
  }
}

# Monitoring Configuration Variables
variable "enable_metrics_server" {
  description = "Enable metrics server deployment"
  type        = bool
  default     = true
}

variable "enable_cluster_autoscaler" {
  description = "Enable cluster autoscaler deployment"
  type        = bool
  default     = true
}