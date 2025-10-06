output "rds_kms_key_arn" {
  description = "ARN of KMS key for RDS encryption"
  value       = aws_kms_key.rds.arn
}

output "redis_kms_key_arn" {
  description = "ARN of KMS key for Redis encryption"
  value       = aws_kms_key.redis.arn
}

output "s3_kms_key_arn" {
  description = "ARN of KMS key for S3 encryption"
  value       = aws_kms_key.s3.arn
}

output "cloudwatch_kms_key_arn" {
  description = "ARN of KMS key for CloudWatch Logs encryption"
  value       = aws_kms_key.cloudwatch.arn
}

output "db_master_password" {
  description = "RDS master password"
  value       = random_password.db_master.result
  sensitive   = true
}

output "db_password_arn" {
  description = "ARN of DB password secret"
  value       = aws_secretsmanager_secret.db_master_password.arn
}

output "redis_auth_token" {
  description = "Redis authentication token"
  value       = random_password.redis_auth_token.result
  sensitive   = true
}

output "redis_password_arn" {
  description = "ARN of Redis password secret"
  value       = aws_secretsmanager_secret.redis_auth_token.arn
}

output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "Security group ID for Redis"
  value       = aws_security_group.redis.id
}

output "waf_acl_arn" {
  description = "ARN of WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "ecs_task_execution_role_arn" {
  description = "ARN of ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

# Additional secret ARNs for ECS
output "db_username_arn" {
  description = "ARN placeholder for DB username"
  value       = aws_secretsmanager_secret.db_master_password.arn
}

output "jwt_secret_arn" {
  description = "ARN placeholder for JWT secret"
  value       = aws_secretsmanager_secret.db_master_password.arn
}

output "app_key_arn" {
  description = "ARN placeholder for app key"
  value       = aws_secretsmanager_secret.db_master_password.arn
}
