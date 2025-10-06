terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }

    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }

    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }

    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # S3 backend configuration
  # Initialize with: terraform init -backend-config=environments/<env>/backend.tfvars
  backend "s3" {
    # These values should be provided via backend config file
    # bucket         = "omni-portal-terraform-state-<env>"
    # key            = "infrastructure/terraform.tfstate"
    # region         = "us-east-1"
    # encrypt        = true
    # dynamodb_table = "omni-portal-terraform-locks-<env>"
    # kms_key_id     = "alias/terraform-state"

    # Optional: Enable versioning and lifecycle rules on the state bucket
    # versioning = true
  }
}

# Primary AWS Provider
provider "aws" {
  region = var.aws_region

  # Assume role for multi-account setups (optional)
  # assume_role {
  #   role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformExecutionRole"
  # }

  # Default tags applied to all resources
  default_tags {
    tags = {
      Project             = "OmniPortal"
      Environment         = var.environment
      ManagedBy           = "Terraform"
      Compliance          = "HIPAA"
      CostCenter          = var.cost_center
      TerraformWorkspace  = terraform.workspace
      LastModified        = timestamp()
    }
  }
}

# Secondary provider for DR region (optional)
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      Project             = "OmniPortal"
      Environment         = "${var.environment}-dr"
      ManagedBy           = "Terraform"
      Compliance          = "HIPAA"
      CostCenter          = var.cost_center
      DisasterRecovery    = "true"
      TerraformWorkspace  = terraform.workspace
    }
  }
}

# Provider configuration for ACM certificate validation (us-east-1 required for CloudFront)
provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "OmniPortal"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Purpose     = "ACM-Certificate"
    }
  }
}
