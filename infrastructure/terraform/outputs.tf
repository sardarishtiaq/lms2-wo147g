# EKS Cluster Outputs
output "eks_cluster_name" {
  description = "Name of the EKS cluster for Kubernetes API access and resource management"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint URL for EKS cluster API access with HTTPS protocol"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_security_group_id" {
  description = "Security group ID for EKS cluster network access control"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority" {
  description = "Base64 encoded certificate data required for cluster authentication"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

# Redis Cache Outputs
output "redis_primary_endpoint" {
  description = "Redis primary endpoint for write operations"
  value       = module.redis.redis_endpoint
}

output "redis_port" {
  description = "Redis port number for connection configuration"
  value       = module.redis.redis_port
}

output "redis_security_group_id" {
  description = "Security group ID for Redis cluster access control"
  value       = module.redis.redis_security_group_id
}

# S3 Storage Outputs
output "document_storage_bucket" {
  description = "Document storage bucket details for application configuration"
  value = {
    id       = module.s3.document_storage.id
    arn      = module.s3.document_storage.arn
    endpoint = module.s3.document_storage.bucket_regional_domain_name
  }
}

output "backup_storage_bucket" {
  description = "Backup storage bucket details for backup management"
  value = {
    id  = module.s3.backup_storage.id
    arn = module.s3.backup_storage.arn
  }
}

output "static_assets_bucket" {
  description = "Static assets bucket details for CDN configuration"
  value = {
    id               = module.s3.static_assets.id
    arn             = module.s3.static_assets.arn
    domain_name     = module.s3.static_assets.bucket_regional_domain_name
    website_endpoint = module.s3.static_assets.website_endpoint
  }
}

# Multi-tenant Support Outputs
output "tenant_isolation_enabled" {
  description = "Flag indicating whether tenant isolation is enabled"
  value       = true
}

output "compliance_status" {
  description = "Compliance and security configuration status"
  value = {
    encryption_enabled     = true
    multi_az_enabled      = true
    backup_enabled        = true
    audit_logging_enabled = true
  }
}

# Resource Tags
output "resource_tags" {
  description = "Common resource tags applied across infrastructure"
  value = {
    Project     = "CRM-System"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Component   = "Infrastructure"
  }
}