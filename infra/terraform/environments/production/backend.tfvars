# Terraform Backend Configuration for Production
# Initialize with: terraform init -backend-config=backend.tfvars

bucket         = "omni-portal-terraform-state-production"
key            = "infrastructure/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "omni-portal-terraform-locks-production"
kms_key_id     = "alias/terraform-state"
