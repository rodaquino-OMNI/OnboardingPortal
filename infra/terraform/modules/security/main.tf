# Security Module - KMS, Secrets Manager, Security Groups, WAF

# KMS Keys for encryption at rest (HIPAA requirement per ADR-004)
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption - ${var.environment}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(
    var.tags,
    {
      Name    = "omni-portal-rds-${var.environment}"
      Purpose = "RDS-Encryption"
    }
  )
}

resource "aws_kms_alias" "rds" {
  name          = "alias/omni-portal-rds-${var.environment}"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_key" "redis" {
  description             = "KMS key for Redis encryption - ${var.environment}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(
    var.tags,
    {
      Name    = "omni-portal-redis-${var.environment}"
      Purpose = "Redis-Encryption"
    }
  )
}

resource "aws_kms_alias" "redis" {
  name          = "alias/omni-portal-redis-${var.environment}"
  target_key_id = aws_kms_key.redis.key_id
}

resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 encryption - ${var.environment}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(
    var.tags,
    {
      Name    = "omni-portal-s3-${var.environment}"
      Purpose = "S3-Encryption"
    }
  )
}

resource "aws_kms_alias" "s3" {
  name          = "alias/omni-portal-s3-${var.environment}"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key" "cloudwatch" {
  description             = "KMS key for CloudWatch Logs encryption - ${var.environment}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${data.aws_region.current.name}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name    = "omni-portal-cloudwatch-${var.environment}"
      Purpose = "CloudWatch-Logs-Encryption"
    }
  )
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/omni-portal-cloudwatch-${var.environment}"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

# Secrets Manager
resource "random_password" "db_master" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "db_master_password" {
  name                    = "omni-portal/${var.environment}/db/master-password"
  description             = "RDS master password for ${var.environment}"
  recovery_window_in_days = 30

  tags = merge(
    var.tags,
    {
      Name = "omni-portal-db-password-${var.environment}"
    }
  )
}

resource "aws_secretsmanager_secret_version" "db_master_password" {
  secret_id     = aws_secretsmanager_secret.db_master_password.id
  secret_string = random_password.db_master.result
}

resource "random_password" "redis_auth_token" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "omni-portal/${var.environment}/redis/auth-token"
  description             = "Redis authentication token for ${var.environment}"
  recovery_window_in_days = 30

  tags = merge(
    var.tags,
    {
      Name = "omni-portal-redis-token-${var.environment}"
    }
  )
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result
}

# Security Groups
resource "aws_security_group" "alb" {
  name        = "omni-portal-alb-${var.environment}"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from Internet (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "omni-portal-alb-${var.environment}"
    }
  )
}

resource "aws_security_group" "ecs_tasks" {
  name        = "omni-portal-ecs-tasks-${var.environment}"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow traffic from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "omni-portal-ecs-tasks-${var.environment}"
    }
  )
}

resource "aws_security_group" "rds" {
  name        = "omni-portal-rds-${var.environment}"
  description = "Security group for RDS database"
  vpc_id      = var.vpc_id

  ingress {
    description     = "MySQL from ECS tasks"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "omni-portal-rds-${var.environment}"
    }
  )
}

resource "aws_security_group" "redis" {
  name        = "omni-portal-redis-${var.environment}"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "omni-portal-redis-${var.environment}"
    }
  )
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  name        = "omni-portal-${var.environment}"
  description = "WAF rules for OmniPortal ${var.environment}"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "omni-portal-waf-${var.environment}"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

# IAM Roles for ECS
resource "aws_iam_role" "ecs_task_execution" {
  name = "omni-portal-ecs-task-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_master_password.arn,
          aws_secretsmanager_secret.redis_auth_token.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.rds.arn,
          aws_kms_key.redis.arn,
          aws_kms_key.s3.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "omni-portal-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
