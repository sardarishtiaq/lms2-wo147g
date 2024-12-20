# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Document Storage Bucket Configuration
resource "aws_s3_bucket" "document_storage" {
  bucket        = "${var.project_name}-${var.environment}-documents"
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Purpose        = "Document Storage"
    TenantIsolated = "true"
  })
}

resource "aws_s3_bucket_versioning" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = var.encryption_algorithm
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Backup Storage Bucket Configuration
resource "aws_s3_bucket" "backup_storage" {
  bucket        = "${var.project_name}-${var.environment}-backups"
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Purpose        = "Backup Storage"
    TenantIsolated = "true"
  })
}

resource "aws_s3_bucket_lifecycle_rule" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id
  id     = "backup-lifecycle"
  enabled = true

  transition {
    days          = var.backup_retention_days
    storage_class = "STANDARD_IA"
  }

  transition {
    days          = var.backup_retention_days * 2
    storage_class = "GLACIER"
  }

  expiration {
    days = var.backup_expiration_days
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = var.encryption_algorithm
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Static Assets Bucket Configuration
resource "aws_s3_bucket" "static_assets" {
  bucket        = "${var.project_name}-${var.environment}-assets"
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Purpose     = "Static Assets"
    CDNEnabled  = "true"
  })
}

resource "aws_s3_bucket_cors_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = var.encryption_algorithm
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Output Definitions
output "document_storage" {
  value = {
    id                        = aws_s3_bucket.document_storage.id
    arn                      = aws_s3_bucket.document_storage.arn
    bucket_regional_domain_name = aws_s3_bucket.document_storage.bucket_regional_domain_name
  }
  description = "Document storage bucket information for IAM and application configuration"
}

output "backup_storage" {
  value = {
    id   = aws_s3_bucket.backup_storage.id
    arn = aws_s3_bucket.backup_storage.arn
  }
  description = "Backup storage bucket information for backup management integration"
}

output "static_assets" {
  value = {
    id                        = aws_s3_bucket.static_assets.id
    arn                      = aws_s3_bucket.static_assets.arn
    bucket_regional_domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    website_endpoint         = aws_s3_bucket.static_assets.website_endpoint
  }
  description = "Static assets bucket information for CloudFront and CDN configuration"
}