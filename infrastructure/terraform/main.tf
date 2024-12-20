# Provider and Backend Configuration
terraform {
  required_version = ">= 1.0.0"

  backend "s3" {
    bucket         = "crm-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.0"
    }
  }
}

# Common Tags for Resource Management
locals {
  common_tags = {
    Project          = "CRM"
    Environment      = var.environment
    ManagedBy       = "Terraform"
    SecurityLevel   = "High"
    ComplianceLevel = "SOC2"
    UpdatedAt       = timestamp()
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.common_tags
  }
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC Module for Network Infrastructure
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  
  # Enhanced networking features
  enable_flow_logs     = true
  flow_logs_retention = 30
  enable_vpc_endpoints = true
  
  tags = local.common_tags
}

# EKS Module for Container Orchestration
module "eks" {
  source = "./modules/eks"

  cluster_name    = "crm-${var.environment}"
  cluster_version = var.eks_cluster_config.cluster_version
  vpc_id          = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # Node group configuration
  node_groups = {
    application = {
      instance_types = var.eks_cluster_config.node_instance_types
      desired_size   = var.eks_cluster_config.desired_nodes
      min_size      = var.eks_cluster_config.min_nodes
      max_size      = var.eks_cluster_config.max_nodes
      capacity_type = "ON_DEMAND"
    }
    system = {
      instance_types = ["t3.large"]
      desired_size   = 2
      min_size      = 2
      max_size      = 4
      capacity_type = "ON_DEMAND"
    }
  }

  # Security configurations
  enable_private_access = true
  enable_public_access = false
  enable_cluster_encryption = true
  cluster_logging_types = var.eks_cluster_config.cluster_logging

  # Compliance and security features
  compliance_requirements = {
    enable_pod_security_policy = true
    enable_network_policy     = true
    enable_audit_logging      = true
    enable_secrets_encryption = true
  }

  tags = local.common_tags
}

# MongoDB Atlas Configuration
resource "mongodbatlas_cluster" "crm_cluster" {
  project_id = var.mongodb_config.project_id
  name       = "crm-${var.environment}"

  # Cluster specifications
  provider_name               = "AWS"
  provider_region_name       = var.aws_region
  provider_instance_size_name = var.mongodb_config.instance_class
  mongo_db_major_version     = var.mongodb_config.version

  # High availability configuration
  num_shards                = 1
  replication_factor        = var.mongodb_config.instance_count
  provider_backup_enabled    = true
  auto_scaling_disk_gb_enabled = var.mongodb_config.auto_scaling_enabled
  
  # Security configurations
  encryption_at_rest_provider = "AWS"
  backup_enabled             = true
  pit_enabled               = true

  # Advanced configurations
  advanced_configuration {
    javascript_enabled = false
    minimum_enabled_tls_protocol = "TLS1_2"
  }
}

# Redis Enterprise Cluster
resource "aws_elasticache_replication_group" "redis_cluster" {
  replication_group_id          = "crm-${var.environment}"
  replication_group_description = "Redis cluster for CRM system"
  
  node_type                     = var.redis_config.node_type
  number_cache_clusters         = var.redis_config.num_cache_nodes
  parameter_group_family        = var.redis_config.parameter_group_family
  automatic_failover_enabled    = var.redis_config.automatic_failover
  multi_az_enabled             = var.redis_config.multi_az
  
  # Security configurations
  at_rest_encryption_enabled    = var.redis_config.at_rest_encryption
  transit_encryption_enabled    = var.redis_config.transit_encryption
  auth_token                   = random_password.redis_auth_token.result
  
  subnet_group_name            = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids           = [aws_security_group.redis_sg.id]
  
  # Backup configurations
  snapshot_retention_limit      = var.redis_config.snapshot_retention_limit
  snapshot_window              = var.redis_config.snapshot_window
  
  tags = local.common_tags
}

# S3 Buckets for File Storage
resource "aws_s3_bucket" "crm_storage" {
  bucket = "crm-storage-${var.environment}-${data.aws_caller_identity.current.account_id}"
  
  # Versioning configuration
  versioning {
    enabled = var.s3_config.versioning
  }
  
  # Security configurations
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "aws:kms"
        kms_master_key_id = aws_kms_key.s3_encryption.arn
      }
    }
  }
  
  # Lifecycle rules
  lifecycle_rule {
    enabled = true
    
    transition {
      days          = var.s3_config.lifecycle_rules.transition_glacier_days
      storage_class = "GLACIER"
    }
    
    expiration {
      days = var.s3_config.lifecycle_rules.expiration_days
    }
  }
  
  tags = local.common_tags
}

# KMS Key for S3 Encryption
resource "aws_kms_key" "s3_encryption" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "mongodb_connection_string" {
  description = "MongoDB connection string"
  value       = mongodbatlas_cluster.crm_cluster.connection_strings[0].standard
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis_cluster.primary_endpoint_address
  sensitive   = true
}