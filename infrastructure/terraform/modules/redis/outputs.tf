# Redis Module Outputs
# Version: 1.0.0
# Redis Enterprise: 7.x

# Core cluster identification outputs
output "cluster_id" {
  description = "Unique identifier of the Redis cluster for resource tracking and monitoring"
  value       = aws_elasticache_cluster.redis_cluster.id
}

output "cluster_arn" {
  description = "Amazon Resource Name (ARN) of the Redis cluster"
  value       = aws_elasticache_cluster.redis_cluster.arn
}

# Connection details outputs
output "primary_endpoint" {
  description = "Primary endpoint for Redis cluster connection with failover support"
  value       = aws_elasticache_cluster.redis_cluster.cache_nodes[0].address
}

output "port" {
  description = "Port number for Redis cluster connection, default is 6379"
  value       = aws_elasticache_cluster.redis_cluster.port
}

output "connection_string" {
  description = "Full connection string for Redis cluster in format redis://host:port"
  value       = format("redis://%s:%s", 
    aws_elasticache_cluster.redis_cluster.cache_nodes[0].address,
    aws_elasticache_cluster.redis_cluster.port
  )
}

# Security outputs
output "security_group_id" {
  description = "ID of the security group attached to Redis cluster for network access control"
  value       = aws_security_group.redis_security_group.id
}

output "encryption_status" {
  description = "Status of encryption features for the Redis cluster"
  value = {
    at_rest_encryption  = aws_elasticache_cluster.redis_cluster.at_rest_encryption_enabled
    transit_encryption = aws_elasticache_cluster.redis_cluster.transit_encryption_enabled
  }
}

# Configuration outputs
output "parameter_group_name" {
  description = "Name of the parameter group used by the Redis cluster"
  value       = aws_elasticache_cluster.redis_cluster.parameter_group_name
}

output "subnet_group_name" {
  description = "Name of the subnet group where Redis cluster is deployed"
  value       = aws_elasticache_cluster.redis_cluster.subnet_group_name
}

# Maintenance and monitoring outputs
output "maintenance_window" {
  description = "Maintenance window for automatic Redis cluster updates"
  value       = aws_elasticache_cluster.redis_cluster.maintenance_window
}

output "monitoring_endpoint" {
  description = "Endpoint for Redis cluster monitoring and metrics collection"
  value       = aws_elasticache_cluster.redis_cluster.configuration_endpoint
}

output "cluster_status" {
  description = "Current status of the Redis cluster for health monitoring"
  value       = aws_elasticache_cluster.redis_cluster.status
}

# High availability outputs
output "multi_az_status" {
  description = "Multi-AZ deployment status of the Redis cluster"
  value       = aws_elasticache_cluster.redis_cluster.multi_az_enabled
}

output "automatic_failover_status" {
  description = "Status of automatic failover capability for the Redis cluster"
  value       = aws_elasticache_cluster.redis_cluster.automatic_failover_enabled
}

# Backup configuration outputs
output "backup_configuration" {
  description = "Backup and snapshot configuration details for the Redis cluster"
  value = {
    snapshot_window          = aws_elasticache_cluster.redis_cluster.snapshot_window
    snapshot_retention_limit = aws_elasticache_cluster.redis_cluster.snapshot_retention_limit
  }
}

# Tags output
output "resource_tags" {
  description = "Tags applied to the Redis cluster resources"
  value       = aws_elasticache_cluster.redis_cluster.tags_all
}