# Terraform and Provider Versions Configuration
# Defines required provider versions for AWS, Kubernetes, and Helm
terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# AWS Provider Configuration
# Configures AWS provider with region, tags, and retry settings
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "CRM"
      ManagedBy   = "Terraform"
    }
  }

  # Enhanced retry configuration for improved reliability
  max_retries = 3
  retry_mode  = "standard"
}

# Data sources for EKS cluster information
# Retrieves cluster endpoint and authentication details
data "aws_eks_cluster" "cluster" {
  name       = "${var.environment}-crm-cluster"
  depends_on = [aws_eks_cluster.main]
}

data "aws_eks_cluster_auth" "cluster" {
  name       = "${var.environment}-crm-cluster"
  depends_on = [aws_eks_cluster.main]
}

# Kubernetes Provider Configuration
# Configures Kubernetes provider with EKS cluster authentication
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      "${var.environment}-crm-cluster"
    ]
  }
}

# Helm Provider Configuration
# Configures Helm provider with EKS cluster authentication
provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        "${var.environment}-crm-cluster"
      ]
    }
  }
}