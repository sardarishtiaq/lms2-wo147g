# Provider configuration
# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource configurations
locals {
  common_tags = merge(var.tags, {
    ManagedBy = "Terraform"
    Project   = "CRM-System"
    UpdatedAt = timestamp()
  })

  cluster_encryption_config = var.enable_cluster_encryption ? [{
    provider_key_arn = coalesce(var.kms_key_arn, aws_kms_key.eks_encryption_key[0].arn)
    resources        = ["secrets"]
  }] : []
}

# KMS key for cluster encryption
resource "aws_kms_key" "eks_encryption_key" {
  count                   = var.enable_cluster_encryption && var.kms_key_arn == null ? 1 : 0
  description             = "KMS key for EKS cluster ${var.cluster_name} encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                 = data.aws_iam_policy_document.kms_policy[0].json
  tags                   = local.common_tags
}

# KMS key alias
resource "aws_kms_alias" "eks_encryption_key_alias" {
  count         = var.enable_cluster_encryption && var.kms_key_arn == null ? 1 : 0
  name          = "alias/eks/${var.cluster_name}"
  target_key_id = aws_kms_key.eks_encryption_key[0].key_id
}

# EKS Cluster
resource "aws_eks_cluster" "eks_cluster" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster_role.arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = var.enable_private_access
    endpoint_public_access  = var.enable_public_access
    public_access_cidrs    = var.enable_public_access ? var.public_access_cidrs : []
    security_group_ids     = [aws_security_group.cluster_sg.id]
  }

  encryption_config = local.cluster_encryption_config

  enabled_cluster_log_types = var.cluster_logging_types

  kubernetes_network_config {
    service_ipv4_cidr = "172.20.0.0/16"
    ip_family         = "ipv4"
  }

  tags = local.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.cluster_policy,
    aws_cloudwatch_log_group.eks_cluster
  ]
}

# EKS Node Groups
resource "aws_eks_node_group" "node_groups" {
  for_each = var.node_groups

  cluster_name    = aws_eks_cluster.eks_cluster.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.node_role.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = each.value.instance_types
  capacity_type  = each.value.capacity_type

  scaling_config {
    desired_size = each.value.desired_size
    min_size     = each.value.min_size
    max_size     = each.value.max_size
  }

  update_config {
    max_unavailable_percentage = 25
  }

  labels = {
    "role"        = each.key
    "environment" = var.tags["Environment"]
  }

  # Launch template configuration for enhanced security
  launch_template {
    name    = aws_launch_template.node_template[each.key].name
    version = aws_launch_template.node_template[each.key].latest_version
  }

  tags = merge(local.common_tags, {
    "k8s.io/cluster-autoscaler/enabled" = var.enable_cluster_autoscaler ? "true" : "false"
    "k8s.io/cluster-autoscaler/${var.cluster_name}" = var.enable_cluster_autoscaler ? "owned" : "false"
  })

  depends_on = [
    aws_iam_role_policy_attachment.node_policy,
    aws_eks_cluster.eks_cluster
  ]

  lifecycle {
    create_before_destroy = true
    ignore_changes       = [scaling_config[0].desired_size]
  }
}

# Launch template for node groups
resource "aws_launch_template" "node_template" {
  for_each = var.node_groups

  name_prefix = "${var.cluster_name}-${each.key}-"
  description = "Launch template for EKS managed node group ${each.key}"

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = 100
      volume_type          = "gp3"
      iops                 = 3000
      encrypted            = true
      kms_key_id          = var.enable_cluster_encryption ? coalesce(var.kms_key_arn, aws_kms_key.eks_encryption_key[0].arn) : null
      delete_on_termination = true
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  monitoring {
    enabled = true
  }

  network_interfaces {
    associate_public_ip_address = false
    security_groups            = [aws_security_group.node_sg.id]
  }

  tag_specifications {
    resource_type = "instance"
    tags          = local.common_tags
  }

  user_data = base64encode(templatefile("${path.module}/templates/userdata.sh.tpl", {
    cluster_name = var.cluster_name
    node_group   = each.key
  }))

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch Log Group for EKS cluster logs
resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/${var.cluster_name}/cluster"
  retention_in_days = 90
  kms_key_id       = var.enable_cluster_encryption ? coalesce(var.kms_key_arn, aws_kms_key.eks_encryption_key[0].arn) : null
  tags             = local.common_tags
}

# Outputs
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = aws_eks_cluster.eks_cluster.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.eks_cluster.certificate_authority[0].data
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_security_group.cluster_sg.id
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN of the EKS cluster"
  value       = aws_iam_role.cluster_role.arn
}

output "node_groups" {
  description = "Map of node groups created and their properties"
  value       = aws_eks_node_group.node_groups
}