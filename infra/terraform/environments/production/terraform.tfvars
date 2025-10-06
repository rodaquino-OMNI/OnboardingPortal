# Production Environment Configuration

environment = "production"
aws_region  = "us-east-1"
cost_center = "engineering"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"

# RDS Configuration
rds_instance_class        = "db.r6g.xlarge"
rds_allocated_storage     = 500
rds_max_allocated_storage = 2000

# Redis Configuration
redis_node_type = "cache.r6g.large"

# ECS Configuration
ecs_api_cpu           = 2048
ecs_api_memory        = 4096
ecs_api_desired_count = 3
api_container_image   = "ghcr.io/your-org/omni-portal:latest"

# SSL/TLS
# Replace with your production ACM certificate ARN
acm_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

# Monitoring
alert_email_addresses = [
  "oncall@example.com",
  "engineering@example.com"
]

# Feature Flags
enable_deletion_protection  = true
enable_enhanced_monitoring  = true
enable_waf                 = true

# HIPAA Compliance
hipaa_compliance_mode       = true
audit_log_retention_days    = 2555  # 7 years
enable_encryption_at_rest   = true
enable_encryption_in_transit = true

# Backups
backup_retention_period = 30
backup_window          = "03:00-04:00"
maintenance_window     = "mon:04:00-mon:05:00"

# High Availability & DR
enable_multi_az             = true
enable_cross_region_backup  = true
dr_region                  = "us-west-2"
