# General Variables
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

# VPC Variables
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# RDS Variables
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS (GB)"
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Maximum allocated storage for RDS autoscaling (GB)"
  type        = number
  default     = 500
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "omni_portal"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "admin"
  sensitive   = true
}

# Redis Variables
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.medium"
}

# ECS Variables
variable "ecs_api_cpu" {
  description = "CPU units for API service (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "ecs_api_memory" {
  description = "Memory for API service (MB)"
  type        = number
  default     = 2048
}

variable "ecs_api_desired_count" {
  description = "Desired count of API tasks"
  type        = number
  default     = 2
}

variable "api_container_image" {
  description = "Docker image for API container"
  type        = string
}

# ALB Variables
variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

# Monitoring Variables
variable "alert_email_addresses" {
  description = "Email addresses for CloudWatch alerts"
  type        = list(string)
  default     = []
}

# Feature Flags
variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS and ECS"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable AWS WAF for ALB"
  type        = bool
  default     = true
}

# HIPAA Compliance Variables
variable "hipaa_compliance_mode" {
  description = "Enable HIPAA compliance features"
  type        = bool
  default     = true
}

variable "audit_log_retention_days" {
  description = "Retention period for audit logs (days)"
  type        = number
  default     = 2555 # 7 years for HIPAA
}

variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for all data stores (HIPAA requirement)"
  type        = bool
  default     = true
}

variable "enable_encryption_in_transit" {
  description = "Enable encryption in transit (HIPAA requirement)"
  type        = bool
  default     = true
}

# Backup Variables
variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "mon:04:00-mon:05:00"
}

# Disaster Recovery Variables
variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = false
}

variable "dr_region" {
  description = "Disaster recovery region"
  type        = string
  default     = "us-west-2"
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
