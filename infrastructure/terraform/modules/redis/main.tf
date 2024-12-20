# Redis Infrastructure Module
# Version: 1.0.0
# Provider: AWS ElastiCache
# Redis Enterprise: 7.x

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Fetch VPC details for network configuration
data "aws_vpc" "selected" {
  id = var.vpc_id
}

# Local variables for configuration
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy  = "terraform"
    Service    = "redis-cache"
    Project    = "crm-system"
  }
  
  redis_tags = merge(local.common_tags, var.tags)
}

# Subnet group for Redis cluster with multi-AZ support
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name        = "${var.cluster_name}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for ${var.cluster_name} Redis cluster"
  
  tags = local.redis_tags
}

# Enhanced parameter group for Redis optimization
resource "aws_elasticache_parameter_group" "redis_parameter_group" {
  family      = "redis7.x"
  name        = "${var.cluster_name}-params"
  description = "Optimized Redis parameters for CRM cache"

  # Performance optimization parameters
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"  # Enable keyspace notifications for expired keys
  }

  parameter {
    name  = "timeout"
    value = "300"  # Connection timeout in seconds
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"  # TCP keepalive interval
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"  # LRU samples for eviction
  }

  parameter {
    name  = "active-defrag-threshold-lower"
    value = "10"  # Memory fragmentation threshold
  }

  tags = local.redis_tags
}

# Enhanced security group with strict access controls
resource "aws_security_group" "redis_security_group" {
  name        = "${var.cluster_name}-sg"
  vpc_id      = var.vpc_id
  description = "Security group for ${var.cluster_name} Redis cluster"

  # Ingress rule for Redis access
  ingress {
    description = "Redis access from VPC"
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
  }

  # Egress rule for outbound traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.redis_tags

  lifecycle {
    create_before_destroy = true
  }
}

# Production-grade Redis cluster with high availability
resource "aws_elasticache_cluster" "redis_cluster" {
  cluster_id                  = var.cluster_name
  engine                      = "redis"
  node_type                   = var.node_type
  num_cache_nodes            = var.num_cache_nodes
  parameter_group_name       = aws_elasticache_parameter_group.redis_parameter_group.name
  subnet_group_name          = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids         = [aws_security_group.redis_security_group.id]
  port                       = var.port
  engine_version             = var.engine_version
  
  # Maintenance and backup configuration
  maintenance_window         = var.maintenance_window
  snapshot_window           = var.snapshot_window
  snapshot_retention_limit  = var.snapshot_retention_limit
  
  # High availability configuration
  multi_az_enabled          = var.multi_az_enabled
  automatic_failover_enabled = var.num_cache_nodes > 1 ? true : false
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  
  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  # Change management
  apply_immediately         = false

  tags = local.redis_tags

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      engine_version
    ]
  }
}

# Outputs for cluster access
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_cluster.redis_cluster.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis cluster port"
  value       = aws_elasticache_cluster.redis_cluster.port
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis_security_group.id
}

output "redis_arn" {
  description = "ARN of the Redis cluster"
  value       = aws_elasticache_cluster.redis_cluster.arn
}