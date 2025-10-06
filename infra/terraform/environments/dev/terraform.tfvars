# Development Environment Configuration

environment = "dev"
aws_region  = "us-east-1"
cost_center = "engineering"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"

# RDS Configuration
rds_instance_class        = "db.t3.medium"
rds_allocated_storage     = 50
rds_max_allocated_storage = 100

# Redis Configuration
redis_node_type = "cache.t3.small"

# ECS Configuration
ecs_api_cpu           = 512
ecs_api_memory        = 1024
ecs_api_desired_count = 1
api_container_image   = "ghcr.io/your-org/omni-portal:latest"

# SSL/TLS
# Replace with your ACM certificate ARN
acm_certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

# Monitoring
alert_email_addresses = ["dev-alerts@example.com"]

# Feature Flags
enable_deletion_protection  = false
enable_enhanced_monitoring  = false
enable_waf                 = true

# HIPAA Compliance
hipaa_compliance_mode       = true
enable_encryption_at_rest   = true
enable_encryption_in_transit = true

# Backups
backup_retention_period = 7
backup_window          = "03:00-04:00"
maintenance_window     = "mon:04:00-mon:05:00"

# High Availability
enable_multi_az             = false
enable_cross_region_backup  = false
