# Document Storage Bucket Outputs
output "document_storage_bucket_id" {
  description = "ID of the document storage S3 bucket for storing tenant-specific documents and files"
  value       = aws_s3_bucket.document_storage.id
}

output "document_storage_bucket_arn" {
  description = "ARN of the document storage S3 bucket for IAM policy configuration"
  value       = aws_s3_bucket.document_storage.arn
}

output "document_storage_bucket_domain" {
  description = "Regional domain name of the document storage bucket for application configuration"
  value       = aws_s3_bucket.document_storage.bucket_regional_domain_name
}

# Backup Storage Bucket Outputs
output "backup_storage_bucket_id" {
  description = "ID of the backup storage S3 bucket for tenant data backups"
  value       = aws_s3_bucket.backup_storage.id
}

output "backup_storage_bucket_arn" {
  description = "ARN of the backup storage S3 bucket for IAM policy configuration"
  value       = aws_s3_bucket.backup_storage.arn
}

output "backup_storage_bucket_domain" {
  description = "Regional domain name of the backup storage bucket for backup service configuration"
  value       = aws_s3_bucket.backup_storage.bucket_regional_domain_name
}

# Static Assets Bucket Outputs
output "static_assets_bucket_id" {
  description = "ID of the static assets S3 bucket for storing application assets"
  value       = aws_s3_bucket.static_assets.id
}

output "static_assets_bucket_arn" {
  description = "ARN of the static assets S3 bucket for IAM policy configuration"
  value       = aws_s3_bucket.static_assets.arn
}

output "static_assets_domain_name" {
  description = "Regional domain name of the static assets bucket for CloudFront origin configuration"
  value       = aws_s3_bucket.static_assets.bucket_regional_domain_name
}

output "static_assets_website_endpoint" {
  description = "Website endpoint of the static assets bucket for direct access configuration"
  value       = aws_s3_bucket.static_assets.website_endpoint
}

# Consolidated Bucket Information
output "s3_buckets" {
  description = "Consolidated information about all S3 buckets for simplified module consumption"
  value = {
    document_storage = {
      id          = aws_s3_bucket.document_storage.id
      arn         = aws_s3_bucket.document_storage.arn
      domain_name = aws_s3_bucket.document_storage.bucket_regional_domain_name
    }
    backup_storage = {
      id          = aws_s3_bucket.backup_storage.id
      arn         = aws_s3_bucket.backup_storage.arn
      domain_name = aws_s3_bucket.backup_storage.bucket_regional_domain_name
    }
    static_assets = {
      id              = aws_s3_bucket.static_assets.id
      arn             = aws_s3_bucket.static_assets.arn
      domain_name     = aws_s3_bucket.static_assets.bucket_regional_domain_name
      website_endpoint = aws_s3_bucket.static_assets.website_endpoint
    }
  }
}