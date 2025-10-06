# Terraform Backend Configuration for Development
# Initialize with: terraform init -backend-config=backend.tfvars

bucket         = "omni-portal-terraform-state-dev"
key            = "infrastructure/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "omni-portal-terraform-locks-dev"
kms_key_id     = "alias/terraform-state"
