# Network Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnet_ids
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

# Database Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_read_replica_endpoint" {
  description = "RDS read replica endpoint (if enabled)"
  value       = try(module.rds.read_replica_endpoint, null)
  sensitive   = true
}

output "rds_instance_id" {
  description = "RDS instance identifier"
  value       = module.rds.instance_id
}

output "rds_instance_arn" {
  description = "ARN of the RDS instance"
  value       = module.rds.instance_arn
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = module.security.rds_security_group_id
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.endpoint
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint (if cluster mode enabled)"
  value       = try(module.redis.reader_endpoint, null)
  sensitive   = true
}

output "redis_cluster_id" {
  description = "Redis cluster identifier"
  value       = module.redis.cluster_id
}

output "redis_security_group_id" {
  description = "Security group ID for Redis"
  value       = module.security.redis_security_group_id
}

# S3 Outputs
output "s3_bucket_names" {
  description = "Names of all S3 buckets"
  value       = module.s3.bucket_names
}

output "s3_bucket_arns" {
  description = "ARNs of all S3 buckets"
  value       = module.s3.bucket_arns
}

output "documents_bucket_name" {
  description = "Name of the documents bucket"
  value       = module.s3.bucket_names["documents"]
}

output "logs_bucket_name" {
  description = "Name of the logs bucket"
  value       = module.s3.bucket_names["logs"]
}

output "assets_bucket_name" {
  description = "Name of the assets bucket"
  value       = module.s3.bucket_names["assets"]
}

output "backups_bucket_name" {
  description = "Name of the backups bucket"
  value       = module.s3.bucket_names["backups"]
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = module.alb.arn
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.alb.zone_id
}

output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = module.security.alb_security_group_id
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs.cluster_arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = "omni-portal-api"
}

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = module.security.ecs_task_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = module.security.ecs_task_role_arn
}

# Security Outputs
output "kms_keys" {
  description = "KMS key ARNs for encryption"
  value = {
    rds        = module.security.rds_kms_key_arn
    redis      = module.security.redis_kms_key_arn
    s3         = module.security.s3_kms_key_arn
    cloudwatch = module.security.cloudwatch_kms_key_arn
  }
  sensitive = true
}

output "waf_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = module.security.waf_acl_arn
}

output "secrets_manager_arns" {
  description = "ARNs of Secrets Manager secrets"
  value = {
    db_password    = module.security.db_password_arn
    redis_password = module.security.redis_password_arn
    jwt_secret     = module.security.jwt_secret_arn
    app_key        = module.security.app_key_arn
  }
  sensitive = true
}

# Monitoring Outputs
output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = module.monitoring.dashboard_name
}

output "cloudwatch_dashboard_url" {
  description = "URL to CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${module.monitoring.dashboard_name}"
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = module.monitoring.sns_topic_arn
}

output "log_group_names" {
  description = "Names of CloudWatch Log Groups"
  value = {
    application = module.monitoring.application_log_group_name
    rds         = module.monitoring.rds_log_group_name
    redis       = module.monitoring.redis_log_group_name
  }
}

# Application Outputs
output "application_url" {
  description = "Application URL (HTTPS)"
  value       = "https://${module.alb.dns_name}"
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = "https://${module.alb.dns_name}/api"
}

# Connection Strings (for deployment)
output "database_connection_string" {
  description = "Database connection string (without password)"
  value       = "mysql://${var.db_username}@${module.rds.endpoint}/${var.db_name}?ssl=true"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string (without auth token)"
  value       = "rediss://${module.redis.endpoint}"
  sensitive   = true
}

# Environment Configuration
output "environment_config" {
  description = "Environment configuration for application deployment"
  value = {
    environment = var.environment
    region      = var.aws_region
    vpc_id      = module.vpc.vpc_id

    database = {
      host     = module.rds.endpoint
      port     = 3306
      database = var.db_name
      ssl      = true
    }

    redis = {
      host = module.redis.endpoint
      port = 6379
      ssl  = true
    }

    storage = {
      documents = module.s3.bucket_names["documents"]
      assets    = module.s3.bucket_names["assets"]
      logs      = module.s3.bucket_names["logs"]
      backups   = module.s3.bucket_names["backups"]
    }

    monitoring = {
      dashboard_url = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${module.monitoring.dashboard_name}"
      sns_topic_arn = module.monitoring.sns_topic_arn
    }
  }
  sensitive = true
}

# Compliance Outputs
output "hipaa_compliance_status" {
  description = "HIPAA compliance features enabled"
  value = {
    encryption_at_rest     = var.enable_encryption_at_rest
    encryption_in_transit  = var.enable_encryption_in_transit
    audit_logs_enabled     = true
    audit_retention_days   = var.audit_log_retention_days
    multi_az_enabled       = var.enable_multi_az
    backup_enabled         = true
    backup_retention_days  = var.backup_retention_period
  }
}

# Deployment Information
output "deployment_info" {
  description = "Information needed for CI/CD deployment"
  value = {
    cluster_name        = module.ecs.cluster_name
    service_name        = "omni-portal-api"
    task_definition_arn = module.ecs.task_definition_arn
    container_name      = "omni-portal-api"
    container_port      = 80
    target_group_arn    = module.alb.target_group_arns["api"]
  }
}
