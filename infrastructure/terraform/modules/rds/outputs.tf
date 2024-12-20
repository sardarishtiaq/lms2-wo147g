# MongoDB Atlas Cluster Identifier Outputs
output "cluster_id" {
  description = "MongoDB Atlas cluster ID for resource identification"
  value       = mongodbatlas_cluster.main.cluster_id
  sensitive   = false
}

output "cluster_name" {
  description = "Name identifier of the MongoDB Atlas cluster"
  value       = mongodbatlas_cluster.main.name
  sensitive   = false
}

output "cluster_state" {
  description = "Current operational state of the MongoDB Atlas cluster for monitoring"
  value       = mongodbatlas_cluster.main.state_name
  sensitive   = false
}

# MongoDB Atlas Connection String Outputs
output "connection_string_standard" {
  description = "Standard connection string for MongoDB Atlas cluster with authentication"
  value       = mongodbatlas_cluster.main.connection_strings[0].standard
  sensitive   = true
}

output "connection_string_standard_srv" {
  description = "Standard SRV connection string for MongoDB Atlas cluster with high availability support"
  value       = mongodbatlas_cluster.main.connection_strings[0].standard_srv
  sensitive   = true
}

output "connection_string_private" {
  description = "Private endpoint connection string for secure MongoDB Atlas cluster access"
  value       = mongodbatlas_cluster.main.connection_strings[0].private
  sensitive   = true
}

output "connection_string_private_srv" {
  description = "Private endpoint SRV connection string for secure MongoDB Atlas cluster access with high availability"
  value       = mongodbatlas_cluster.main.connection_strings[0].private_srv
  sensitive   = true
}

# MongoDB Atlas Connection Options
output "connection_options" {
  description = "Connection options for MongoDB Atlas cluster configuration"
  value = {
    retryWrites      = true
    replicaSet       = "atlas-replica-set"
    ssl              = true
    authSource       = "admin"
    maxPoolSize      = 100
    minPoolSize      = 10
    maxIdleTimeMS    = 120000
    connectTimeoutMS = 20000
  }
  sensitive = false
}

# MongoDB Atlas Monitoring Outputs
output "monitoring_config" {
  description = "Monitoring configuration details for the MongoDB Atlas cluster"
  value = {
    cluster_name = mongodbatlas_cluster.main.name
    state        = mongodbatlas_cluster.main.state_name
    version      = mongodbatlas_cluster.main.mongo_db_version
    type         = mongodbatlas_cluster.main.cluster_type
    region       = mongodbatlas_cluster.main.provider_region_name
  }
  sensitive = false
}