# Cluster Access Configuration
output "cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = aws_eks_cluster.eks_cluster.endpoint
}

output "cluster_name" {
  description = "The name of the EKS cluster"
  value       = aws_eks_cluster.eks_cluster.name
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required for cluster authentication"
  value       = aws_eks_cluster.eks_cluster.certificate_authority[0].data
  sensitive   = true
}

# Security Configuration
output "cluster_security_group_id" {
  description = "ID of the security group attached to the EKS cluster for network access control"
  value       = aws_eks_cluster.eks_cluster.vpc_config[0].cluster_security_group_id
}

output "cluster_iam_role_arn" {
  description = "ARN of the IAM role used by the EKS cluster for AWS service permissions"
  value       = aws_eks_cluster.eks_cluster.role_arn
}

# Node Group Configuration
output "node_groups" {
  description = "Map of all EKS node groups with their configurations including instance types, scaling settings, and labels"
  value = {
    for k, v in aws_eks_node_group.node_groups : k => {
      node_group_name = v.node_group_name
      status         = v.status
      capacity_type  = v.capacity_type
      instance_types = v.instance_types
      scaling_config = v.scaling_config
      labels        = v.labels
      taints        = v.taints
      subnet_ids    = v.subnet_ids
    }
  }
}

# Version Information
output "cluster_version" {
  description = "The Kubernetes version running on the EKS cluster"
  value       = aws_eks_cluster.eks_cluster.version
}

# Network Configuration
output "cluster_vpc_config" {
  description = "VPC configuration for the EKS cluster including subnets and security groups"
  value = {
    vpc_id             = aws_eks_cluster.eks_cluster.vpc_config[0].vpc_id
    subnet_ids         = aws_eks_cluster.eks_cluster.vpc_config[0].subnet_ids
    security_group_ids = aws_eks_cluster.eks_cluster.vpc_config[0].security_group_ids
  }
}

# OIDC Configuration
output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster for the OpenID Connect identity provider"
  value       = aws_eks_cluster.eks_cluster.identity[0].oidc[0].issuer
}

# Logging Configuration
output "cluster_logging_types" {
  description = "List of enabled control plane logging types"
  value       = aws_eks_cluster.eks_cluster.enabled_cluster_log_types
}