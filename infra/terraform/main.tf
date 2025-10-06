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
  }

  backend "s3" {
    # Backend configuration provided via backend.tfvars
    # bucket         = "omni-portal-terraform-state"
    # key            = "infrastructure/terraform.tfstate"
    # region         = "us-east-1"
    # encrypt        = true
    # dynamodb_table = "omni-portal-terraform-locks"
    # kms_key_id     = "alias/terraform-state"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "OmniPortal"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "HIPAA"
      CostCenter  = var.cost_center
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  account_id = data.aws_caller_identity.current.account_id

  common_tags = {
    Project     = "OmniPortal"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Compliance  = "HIPAA"
  }

  # Database encryption settings per ADR-004
  db_encryption_config = {
    storage_encrypted   = true
    kms_key_id         = module.security.rds_kms_key_arn
    iam_database_authentication_enabled = true
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)

  enable_nat_gateway     = true
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # VPC Flow Logs for HIPAA compliance
  enable_flow_logs              = true
  flow_logs_retention_days      = 90
  flow_logs_kms_key_arn        = module.security.cloudwatch_kms_key_arn

  tags = local.common_tags
}

# Security Module (KMS, Secrets Manager, WAF)
module "security" {
  source = "./modules/security"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id

  # KMS key rotation per ADR-004
  enable_key_rotation = true

  # Secrets encryption
  secrets = {
    db_master_password = {
      description = "RDS master password"
      kms_key_id  = null # Uses default secrets manager key
    }
    redis_auth_token = {
      description = "Redis authentication token"
      kms_key_id  = null
    }
    jwt_secret = {
      description = "JWT signing secret"
      kms_key_id  = null
    }
  }

  # WAF rules
  waf_rules = {
    rate_limit = {
      priority = 1
      limit    = 2000
      scope    = "REGIONAL"
    }
    sql_injection = {
      priority = 2
      enabled  = true
    }
    xss_protection = {
      priority = 3
      enabled  = true
    }
  }

  tags = local.common_tags
}

# RDS Module (MySQL 8.0 with encryption per ADR-004)
module "rds" {
  source = "./modules/rds"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id

  # Database subnet group
  subnet_ids = module.vpc.private_subnet_ids

  # Instance configuration
  engine               = "mysql"
  engine_version       = "8.0.35"
  instance_class       = var.rds_instance_class
  allocated_storage    = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage

  # Database settings
  db_name  = var.db_name
  username = var.db_username
  password = module.security.db_master_password

  # Multi-AZ for high availability
  multi_az = var.environment == "production" ? true : false

  # Encryption settings per ADR-004
  storage_encrypted                  = local.db_encryption_config.storage_encrypted
  kms_key_id                        = local.db_encryption_config.kms_key_id
  iam_database_authentication_enabled = local.db_encryption_config.iam_database_authentication_enabled

  # Backup configuration
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  # Enhanced monitoring
  enabled_cloudwatch_logs_exports = ["error", "general", "slowquery", "audit"]
  monitoring_interval            = 60
  monitoring_role_arn           = module.monitoring.rds_monitoring_role_arn

  # Performance Insights
  performance_insights_enabled    = true
  performance_insights_kms_key_id = module.security.rds_kms_key_arn
  performance_insights_retention_period = 7

  # Read replica for production
  create_read_replica = var.environment == "production" ? true : false
  replica_instance_class = var.environment == "production" ? var.rds_instance_class : null

  # Parameter group for HIPAA compliance
  parameter_group_family = "mysql8.0"
  parameters = [
    {
      name  = "require_secure_transport"
      value = "ON"
    },
    {
      name  = "log_bin_trust_function_creators"
      value = "1"
    },
    {
      name  = "slow_query_log"
      value = "1"
    },
    {
      name  = "long_query_time"
      value = "2"
    }
  ]

  # Security
  vpc_security_group_ids = [module.security.rds_security_group_id]

  # Deletion protection
  deletion_protection = var.environment == "production" ? true : false
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "omni-portal-final-${formatdate("YYYYMMDD-hhmm", timestamp())}" : null

  tags = local.common_tags
}

# ElastiCache Redis Module
module "redis" {
  source = "./modules/redis"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id

  # Subnet group
  subnet_ids = module.vpc.private_subnet_ids

  # Cluster configuration
  cluster_id           = "omni-portal-${var.environment}"
  engine_version       = "7.0"
  node_type           = var.redis_node_type
  num_cache_nodes     = var.environment == "production" ? 3 : 2
  parameter_group_family = "redis7"

  # High availability
  automatic_failover_enabled = var.environment == "production" ? true : false
  multi_az_enabled          = var.environment == "production" ? true : false

  # Encryption
  at_rest_encryption_enabled = true
  kms_key_id                = module.security.redis_kms_key_arn
  transit_encryption_enabled = true
  auth_token                = module.security.redis_auth_token

  # Maintenance
  maintenance_window = "tue:03:00-tue:04:00"
  snapshot_window    = "02:00-03:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 1

  # CloudWatch logs
  log_delivery_configuration = [
    {
      destination      = module.monitoring.redis_log_group_name
      destination_type = "cloudwatch-logs"
      log_format       = "json"
      log_type         = "slow-log"
    },
    {
      destination      = module.monitoring.redis_log_group_name
      destination_type = "cloudwatch-logs"
      log_format       = "json"
      log_type         = "engine-log"
    }
  ]

  # Security
  security_group_ids = [module.security.redis_security_group_id]

  tags = local.common_tags
}

# S3 Module
module "s3" {
  source = "./modules/s3"

  environment = var.environment

  buckets = {
    # Document storage bucket
    documents = {
      bucket_name = "omni-portal-documents-${var.environment}-${random_id.suffix.hex}"
      versioning  = true
      lifecycle_rules = [
        {
          id      = "archive-old-documents"
          enabled = true
          transition = [
            {
              days          = 90
              storage_class = "GLACIER"
            }
          ]
        }
      ]
    }

    # Application logs bucket
    logs = {
      bucket_name = "omni-portal-logs-${var.environment}-${random_id.suffix.hex}"
      versioning  = true
      lifecycle_rules = [
        {
          id      = "expire-old-logs"
          enabled = true
          expiration = {
            days = 90
          }
        }
      ]
    }

    # Static assets bucket
    assets = {
      bucket_name = "omni-portal-assets-${var.environment}-${random_id.suffix.hex}"
      versioning  = true
    }

    # Backup bucket
    backups = {
      bucket_name = "omni-portal-backups-${var.environment}-${random_id.suffix.hex}"
      versioning  = true
      lifecycle_rules = [
        {
          id      = "move-to-glacier"
          enabled = true
          transition = [
            {
              days          = 30
              storage_class = "GLACIER"
            }
          ]
        }
      ]
    }
  }

  # Encryption using KMS (HIPAA requirement)
  kms_key_arn = module.security.s3_kms_key_arn

  # Access logging
  enable_access_logging = true
  access_log_bucket     = "omni-portal-logs-${var.environment}-${random_id.suffix.hex}"

  tags = local.common_tags
}

# ECS Fargate Module
module "ecs" {
  source = "./modules/ecs"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id

  # Subnets
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids

  # Cluster configuration
  cluster_name = "omni-portal-${var.environment}"

  # Service configuration
  services = {
    api = {
      name            = "omni-portal-api"
      cpu             = var.ecs_api_cpu
      memory          = var.ecs_api_memory
      desired_count   = var.ecs_api_desired_count
      container_image = var.api_container_image
      container_port  = 80

      # Health check
      health_check = {
        path                = "/api/health"
        healthy_threshold   = 2
        unhealthy_threshold = 3
        timeout             = 5
        interval            = 30
        matcher             = "200"
      }

      # Auto-scaling
      autoscaling = {
        min_capacity = var.environment == "production" ? 3 : 2
        max_capacity = var.environment == "production" ? 10 : 4
        cpu_threshold = 70
        memory_threshold = 80
      }

      # Environment variables
      environment_variables = {
        APP_ENV           = var.environment
        DB_CONNECTION     = "mysql"
        DB_HOST           = module.rds.endpoint
        DB_PORT           = "3306"
        DB_DATABASE       = var.db_name
        REDIS_HOST        = module.redis.endpoint
        REDIS_PORT        = "6379"
        AWS_REGION        = var.aws_region
        LOG_LEVEL         = var.environment == "production" ? "error" : "debug"
      }

      # Secrets from Secrets Manager
      secrets = {
        DB_USERNAME      = module.security.db_username_arn
        DB_PASSWORD      = module.security.db_password_arn
        REDIS_PASSWORD   = module.security.redis_password_arn
        JWT_SECRET       = module.security.jwt_secret_arn
        APP_KEY          = module.security.app_key_arn
      }
    }
  }

  # Load balancer configuration
  alb_security_group_id = module.alb.security_group_id
  target_group_arns     = {
    api = module.alb.target_group_arns["api"]
  }

  # CloudWatch logs
  log_group_kms_key_id = module.security.cloudwatch_kms_key_arn
  log_retention_days   = 90

  # IAM roles
  task_execution_role_arn = module.security.ecs_task_execution_role_arn
  task_role_arn          = module.security.ecs_task_role_arn

  tags = local.common_tags
}

# Application Load Balancer Module
module "alb" {
  source = "./modules/alb"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id

  # Subnets (ALB must be in public subnets)
  subnet_ids = module.vpc.public_subnet_ids

  # ALB configuration
  name               = "omni-portal-${var.environment}"
  internal           = false
  load_balancer_type = "application"

  # Security
  security_group_ids = [module.security.alb_security_group_id]
  waf_acl_arn       = module.security.waf_acl_arn

  # SSL/TLS
  certificate_arn = var.acm_certificate_arn
  ssl_policy     = "ELBSecurityPolicy-TLS-1-2-2017-01"

  # Access logs
  enable_access_logs = true
  access_logs_bucket = module.s3.bucket_ids["logs"]
  access_logs_prefix = "alb"

  # Target groups
  target_groups = {
    api = {
      name                 = "omni-portal-api-${var.environment}"
      port                 = 80
      protocol             = "HTTP"
      target_type          = "ip"
      deregistration_delay = 30

      health_check = {
        enabled             = true
        path                = "/api/health"
        protocol            = "HTTP"
        healthy_threshold   = 2
        unhealthy_threshold = 3
        timeout             = 5
        interval            = 30
        matcher             = "200"
      }

      stickiness = {
        enabled         = true
        type            = "lb_cookie"
        cookie_duration = 86400
      }
    }
  }

  # Listener rules
  listeners = {
    http = {
      port     = 80
      protocol = "HTTP"
      default_action = {
        type = "redirect"
        redirect = {
          port        = "443"
          protocol    = "HTTPS"
          status_code = "HTTP_301"
        }
      }
    }

    https = {
      port            = 443
      protocol        = "HTTPS"
      certificate_arn = var.acm_certificate_arn
      default_action = {
        type             = "forward"
        target_group_key = "api"
      }
    }
  }

  tags = local.common_tags
}

# CloudWatch Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment

  # Metric alarms
  create_alarms = true

  # RDS alarms
  rds_alarms = {
    cpu_utilization = {
      threshold          = 80
      evaluation_periods = 2
      period             = 300
    }
    freeable_memory = {
      threshold          = 1000000000 # 1GB in bytes
      evaluation_periods = 2
      period             = 300
    }
    disk_queue_depth = {
      threshold          = 20
      evaluation_periods = 2
      period             = 60
    }
  }

  # Redis alarms
  redis_alarms = {
    cpu_utilization = {
      threshold          = 75
      evaluation_periods = 2
      period             = 300
    }
    memory_usage = {
      threshold          = 90
      evaluation_periods = 2
      period             = 300
    }
  }

  # ALB alarms
  alb_alarms = {
    target_response_time = {
      threshold          = 1 # 1 second
      evaluation_periods = 2
      period             = 60
    }
    unhealthy_host_count = {
      threshold          = 1
      evaluation_periods = 2
      period             = 60
    }
    http_5xx_count = {
      threshold          = 10
      evaluation_periods = 1
      period             = 60
    }
  }

  # ECS alarms
  ecs_alarms = {
    cpu_utilization = {
      threshold          = 80
      evaluation_periods = 2
      period             = 300
    }
    memory_utilization = {
      threshold          = 80
      evaluation_periods = 2
      period             = 300
    }
  }

  # SNS topic for alerts
  create_sns_topic = true
  sns_topic_name   = "omni-portal-alerts-${var.environment}"
  sns_subscriptions = var.alert_email_addresses

  # CloudWatch dashboard
  create_dashboard = true
  dashboard_name   = "omni-portal-${var.environment}"

  # CloudWatch log groups
  log_groups = {
    application = {
      name              = "/aws/ecs/omni-portal-${var.environment}/api"
      retention_in_days = 90
      kms_key_id       = module.security.cloudwatch_kms_key_arn
    }
    rds = {
      name              = "/aws/rds/omni-portal-${var.environment}"
      retention_in_days = 90
      kms_key_id       = module.security.cloudwatch_kms_key_arn
    }
    redis = {
      name              = "/aws/elasticache/omni-portal-${var.environment}"
      retention_in_days = 90
      kms_key_id       = module.security.cloudwatch_kms_key_arn
    }
  }

  # Resource ARNs for monitoring
  rds_instance_id    = module.rds.instance_id
  redis_cluster_id   = module.redis.cluster_id
  alb_arn_suffix     = module.alb.arn_suffix
  ecs_cluster_name   = module.ecs.cluster_name
  ecs_service_name   = "omni-portal-api"

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.redis.endpoint
  sensitive   = true
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "s3_bucket_names" {
  description = "S3 bucket names"
  value       = module.s3.bucket_names
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${module.monitoring.dashboard_name}"
}
