# AWS Production Deployment Guide for AUSTA Health Portal

## Executive Summary

This comprehensive guide provides detailed technical instructions for deploying the AUSTA Health Portal to AWS production infrastructure. The deployment leverages AWS managed services for high availability, scalability, and security while maintaining HIPAA compliance and healthcare data protection standards.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Components](#infrastructure-components)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Security Configuration](#security-configuration)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Disaster Recovery](#disaster-recovery)
8. [Cost Optimization](#cost-optimization)
9. [Troubleshooting](#troubleshooting)

## Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Internet                                 │
└────────────────────┬─────────────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │  CloudFront │ (Global CDN)
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │     WAF     │ (Web Application Firewall)
              └──────┬──────┘
                     │
         ┌───────────▼───────────┐
         │   Application Load    │
         │      Balancer         │
         └───────────┬───────────┘
                     │
      ┌──────────────┴──────────────┐
      │                             │
┌─────▼─────┐                ┌─────▼─────┐
│  ECS/EKS  │                │  ECS/EKS  │
│  Cluster  │                │  Cluster  │
│   (AZ 1)  │                │   (AZ 2)  │
└─────┬─────┘                └─────┬─────┘
      │                             │
      └──────────┬──────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐   ┌───▼───┐   ┌───▼───┐
│ RDS   │   │ Redis │   │  S3   │
│MySQL  │   │Cluster│   │Bucket │
└───────┘   └───────┘   └───────┘
```

### Service Components

| Component | AWS Service | Purpose | Configuration |
|-----------|------------|---------|---------------|
| CDN | CloudFront | Global content delivery | Multi-region edge locations |
| WAF | AWS WAF | Application security | Rate limiting, IP filtering |
| Load Balancer | ALB | HTTPS termination, routing | Multi-AZ deployment |
| Container Orchestration | ECS Fargate / EKS | Application runtime | Auto-scaling 2-10 tasks |
| Database | RDS MySQL 8.0 | Primary data store | Multi-AZ, db.t3.large |
| Cache | ElastiCache Redis 7 | Session/cache storage | Cluster mode enabled |
| File Storage | S3 + EFS | Document uploads | Versioning, encryption |
| Secrets | Secrets Manager | Credential management | Auto-rotation enabled |
| Monitoring | CloudWatch + X-Ray | Observability | Full stack tracing |

## Prerequisites

### Required AWS Resources

```bash
# AWS CLI installed and configured
aws --version  # Should be >= 2.13.0

# Required IAM permissions
- AmazonECS_FullAccess
- AmazonRDSFullAccess
- AmazonElastiCacheFullAccess
- AmazonS3FullAccess
- AmazonVPCFullAccess
- SecretsManagerReadWrite
- CloudWatchFullAccess
- IAMFullAccess

# Tools required
- Docker >= 24.0
- Terraform >= 1.5 or AWS CDK >= 2.100
- kubectl >= 1.28 (if using EKS)
- helm >= 3.12 (if using EKS)
```

### Account Preparation

```bash
# Set AWS region and account
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create S3 bucket for Terraform state (if using Terraform)
aws s3api create-bucket \
  --bucket austa-terraform-state-${AWS_ACCOUNT_ID} \
  --region ${AWS_REGION} \
  --create-bucket-configuration LocationConstraint=${AWS_REGION}

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket austa-terraform-state-${AWS_ACCOUNT_ID} \
  --versioning-configuration Status=Enabled
```

## Infrastructure Components

### 1. VPC and Networking

```yaml
# vpc-configuration.yaml
VPC:
  CIDR: 10.0.0.0/16
  EnableDnsHostnames: true
  EnableDnsSupport: true
  
Subnets:
  Public:
    - AZ: us-east-1a
      CIDR: 10.0.1.0/24
    - AZ: us-east-1b
      CIDR: 10.0.2.0/24
    - AZ: us-east-1c
      CIDR: 10.0.3.0/24
      
  Private:
    - AZ: us-east-1a
      CIDR: 10.0.11.0/24
    - AZ: us-east-1b
      CIDR: 10.0.12.0/24
    - AZ: us-east-1c
      CIDR: 10.0.13.0/24
      
  Database:
    - AZ: us-east-1a
      CIDR: 10.0.21.0/24
    - AZ: us-east-1b
      CIDR: 10.0.22.0/24
      
NAT Gateways:
  - Per availability zone for high availability
  
Security Groups:
  - ALB: Ports 80, 443 from 0.0.0.0/0
  - ECS: Port 3000, 9000 from ALB
  - RDS: Port 3306 from ECS
  - Redis: Port 6379 from ECS
```

### 2. Container Registry (ECR)

```bash
# Create ECR repositories
aws ecr create-repository \
  --repository-name austa/backend \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

aws ecr create-repository \
  --repository-name austa/frontend \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

aws ecr create-repository \
  --repository-name austa/nginx \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Get login token
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

### 3. Build and Push Docker Images

```bash
# Build production images
cd /path/to/omni-portal

# Backend image with production optimizations
docker build \
  --target production \
  --build-arg APP_ENV=production \
  -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/backend:latest \
  -f backend/Dockerfile \
  backend/

# Frontend image with production build
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.austahealth.com \
  --build-arg NODE_ENV=production \
  -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/frontend:latest \
  -f frontend/Dockerfile \
  frontend/

# Nginx image with custom configuration
docker build \
  -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/nginx:latest \
  -f docker/nginx/Dockerfile \
  docker/nginx/

# Push all images
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/backend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/frontend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/nginx:latest
```

## Step-by-Step Deployment

### Step 1: Database Setup (RDS MySQL)

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name austa-db-subnet-group \
  --db-subnet-group-description "AUSTA Health Portal DB Subnet Group" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Create parameter group for MySQL 8.0
aws rds create-db-parameter-group \
  --db-parameter-group-name austa-mysql80-params \
  --db-parameter-group-family mysql8.0 \
  --description "Custom parameters for AUSTA MySQL 8.0"

# Modify parameters for production
aws rds modify-db-parameter-group \
  --db-parameter-group-name austa-mysql80-params \
  --parameters \
    "ParameterName=max_connections,ParameterValue=500,ApplyMethod=immediate" \
    "ParameterName=innodb_buffer_pool_size,ParameterValue={DBInstanceClassMemory*3/4},ApplyMethod=pending-reboot" \
    "ParameterName=slow_query_log,ParameterValue=1,ApplyMethod=immediate" \
    "ParameterName=long_query_time,ParameterValue=2,ApplyMethod=immediate"

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier austa-mysql-prod \
  --db-instance-class db.t3.large \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username admin \
  --master-user-password $(aws secretsmanager get-random-password --password-length 32 --no-include-space | jq -r .RandomPassword) \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name austa-db-subnet-group \
  --db-parameter-group-name austa-mysql80-params \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Mon:04:00-Mon:05:00" \
  --multi-az \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --deletion-protection \
  --copy-tags-to-snapshot
```

### Step 2: Cache Setup (ElastiCache Redis)

```bash
# Create cache subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name austa-cache-subnet-group \
  --cache-subnet-group-description "AUSTA Health Portal Cache Subnet Group" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Create parameter group for Redis 7
aws elasticache create-cache-parameter-group \
  --cache-parameter-group-name austa-redis7-params \
  --cache-parameter-group-family redis7 \
  --description "Custom parameters for AUSTA Redis 7"

# Modify Redis parameters
aws elasticache modify-cache-parameter-group \
  --cache-parameter-group-name austa-redis7-params \
  --parameter-name-values \
    "ParameterName=maxmemory-policy,ParameterValue=allkeys-lru" \
    "ParameterName=timeout,ParameterValue=300" \
    "ParameterName=tcp-keepalive,ParameterValue=60"

# Create Redis replication group (cluster mode)
aws elasticache create-replication-group \
  --replication-group-id austa-redis-cluster \
  --replication-group-description "AUSTA Health Portal Redis Cluster" \
  --cache-node-type cache.t3.medium \
  --engine redis \
  --engine-version 7.0 \
  --num-node-groups 2 \
  --replicas-per-node-group 1 \
  --automatic-failover-enabled \
  --cache-subnet-group-name austa-cache-subnet-group \
  --cache-parameter-group-name austa-redis7-params \
  --security-group-ids sg-yyyyy \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token $(aws secretsmanager get-random-password --password-length 32 --no-include-space | jq -r .RandomPassword) \
  --snapshot-retention-limit 5 \
  --snapshot-window 03:00-05:00 \
  --preferred-maintenance-window sun:05:00-sun:07:00 \
  --notification-topic-arn arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:austa-alerts
```

### Step 3: Container Orchestration (ECS Fargate)

#### Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name austa-production \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1,base=2 \
    capacityProvider=FARGATE_SPOT,weight=4 \
  --settings name=containerInsights,value=enabled
```

#### Task Definitions

```json
# backend-task-definition.json
{
  "family": "austa-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/austaBackendTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 9000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "APP_ENV", "value": "production"},
        {"name": "APP_DEBUG", "value": "false"},
        {"name": "LOG_CHANNEL", "value": "cloudwatch"},
        {"name": "CACHE_DRIVER", "value": "redis"},
        {"name": "SESSION_DRIVER", "value": "redis"},
        {"name": "QUEUE_CONNECTION", "value": "redis"}
      ],
      "secrets": [
        {
          "name": "APP_KEY",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:austa/app-key"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:austa/db-password"
        },
        {
          "name": "REDIS_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:austa/redis-password"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "efs-storage",
          "containerPath": "/var/www/backend/storage/app"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/austa-backend",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "backend"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "php artisan health:check || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ],
  "volumes": [
    {
      "name": "efs-storage",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-xxxxx",
        "transitEncryption": "ENABLED",
        "authorizationConfig": {
          "accessPointId": "fsap-xxxxx",
          "iam": "ENABLED"
        }
      }
    }
  ]
}
```

```json
# frontend-task-definition.json
{
  "family": "austa-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/austaFrontendTaskRole",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/austa/frontend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "NEXT_PUBLIC_API_URL", "value": "https://api.austahealth.com"},
        {"name": "NEXT_TELEMETRY_DISABLED", "value": "1"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/austa-frontend",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "frontend"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node healthcheck.js || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 30
      }
    }
  ]
}
```

#### Register Task Definitions

```bash
# Register backend task
aws ecs register-task-definition \
  --cli-input-json file://backend-task-definition.json

# Register frontend task
aws ecs register-task-definition \
  --cli-input-json file://frontend-task-definition.json
```

#### Create ECS Services

```bash
# Create backend service
aws ecs create-service \
  --cluster austa-production \
  --service-name austa-backend \
  --task-definition austa-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration \
    "awsvpcConfiguration={
      subnets=[subnet-xxxxx,subnet-yyyyy],
      securityGroups=[sg-backend],
      assignPublicIp=DISABLED
    }" \
  --load-balancers \
    "targetGroupArn=arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT_ID}:targetgroup/austa-backend-tg,containerName=backend,containerPort=9000" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration \
    "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
  --enable-execute-command

# Create frontend service
aws ecs create-service \
  --cluster austa-production \
  --service-name austa-frontend \
  --task-definition austa-frontend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration \
    "awsvpcConfiguration={
      subnets=[subnet-xxxxx,subnet-yyyyy],
      securityGroups=[sg-frontend],
      assignPublicIp=DISABLED
    }" \
  --load-balancers \
    "targetGroupArn=arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT_ID}:targetgroup/austa-frontend-tg,containerName=frontend,containerPort=3000" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration \
    "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}"
```

### Step 4: Load Balancer Configuration

```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name austa-alb \
  --subnets subnet-xxxxx subnet-yyyyy subnet-zzzzz \
  --security-groups sg-alb \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4

# Create target groups
aws elbv2 create-target-group \
  --name austa-backend-tg \
  --protocol HTTP \
  --port 9000 \
  --vpc-id vpc-xxxxx \
  --target-type ip \
  --health-check-enabled \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 10 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher HttpCode=200

aws elbv2 create-target-group \
  --name austa-frontend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxx \
  --target-type ip \
  --health-check-enabled \
  --health-check-path /_next/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 10 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher HttpCode=200

# Create HTTPS listener with ACM certificate
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT_ID}:loadbalancer/app/austa-alb/xxxxx \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:${AWS_REGION}:${AWS_ACCOUNT_ID}:certificate/xxxxx \
  --default-actions \
    Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT_ID}:targetgroup/austa-frontend-tg

# Add path-based routing rules
aws elbv2 create-rule \
  --listener-arn arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT_ID}:listener/app/austa-alb/xxxxx \
  --conditions Field=path-pattern,Values="/api/*" \
  --priority 1 \
  --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT_ID}:targetgroup/austa-backend-tg
```

### Step 5: Auto Scaling Configuration

```bash
# Register scalable targets
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/austa-production/austa-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/austa-production/austa-frontend \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policies (CPU-based)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/austa-production/austa-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name austa-backend-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    '{
      "TargetValue": 70.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
      },
      "ScaleInCooldown": 300,
      "ScaleOutCooldown": 60
    }'

# Memory-based scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/austa-production/austa-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name austa-backend-memory-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    '{
      "TargetValue": 75.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ECSServiceAverageMemoryUtilization"
      },
      "ScaleInCooldown": 300,
      "ScaleOutCooldown": 60
    }'
```

## Security Configuration

### 1. Secrets Management

```bash
# Store application secrets
aws secretsmanager create-secret \
  --name austa/app-key \
  --description "Laravel application encryption key" \
  --secret-string "base64:$(openssl rand -base64 32)"

aws secretsmanager create-secret \
  --name austa/db-password \
  --description "MySQL database password" \
  --secret-string "$(aws secretsmanager get-random-password --password-length 32 --no-include-space | jq -r .RandomPassword)"

aws secretsmanager create-secret \
  --name austa/redis-password \
  --description "Redis authentication token" \
  --secret-string "$(aws secretsmanager get-random-password --password-length 32 --no-include-space | jq -r .RandomPassword)"

# Enable automatic rotation
aws secretsmanager put-secret-rotation-configuration \
  --secret-id austa/db-password \
  --rotation-lambda-arn arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:SecretsManagerRDSMySQLRotation \
  --rotation-rules AutomaticallyAfterDays=30
```

### 2. WAF Configuration

```json
# waf-rules.json
{
  "Rules": [
    {
      "Name": "RateLimitRule",
      "Priority": 1,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "GeoBlockRule",
      "Priority": 2,
      "Statement": {
        "GeoMatchStatement": {
          "CountryCodes": ["CN", "RU", "KP"]
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "SQLiRule",
      "Priority": 3,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesSQLiRuleSet"
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "XSSRule",
      "Priority": 4,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesKnownBadInputsRuleSet"
        }
      },
      "Action": {
        "Block": {}
      }
    }
  ]
}
```

```bash
# Create WAF WebACL
aws wafv2 create-web-acl \
  --name austa-waf \
  --scope REGIONAL \
  --default-action Allow={} \
  --rules file://waf-rules.json \
  --visibility-config \
    SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=austa-waf

# Associate with ALB
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:${AWS_REGION}:${AWS_ACCOUNT_ID}:regional/webacl/austa-waf/xxxxx \
  --resource-arn arn:aws:elasticloadbalancing:${AWS_REGION}:${AWS_ACCOUNT_ID}:loadbalancer/app/austa-alb/xxxxx
```

### 3. IAM Roles and Policies

```json
# backend-task-role-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::austa-documents/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:austa/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:key/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ],
      "Resource": "*"
    }
  ]
}
```

## Monitoring and Observability

### 1. CloudWatch Configuration

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name AUSTA-Production \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/ECS", "CPUUtilization", {"stat": "Average"}],
            [".", "MemoryUtilization", {"stat": "Average"}],
            ["AWS/ApplicationELB", "TargetResponseTime", {"stat": "Average"}],
            [".", "RequestCount", {"stat": "Sum"}],
            [".", "HTTPCode_Target_4XX_Count", {"stat": "Sum"}],
            [".", "HTTPCode_Target_5XX_Count", {"stat": "Sum"}],
            ["AWS/RDS", "DatabaseConnections"],
            [".", "CPUUtilization"],
            [".", "FreeableMemory"],
            ["AWS/ElastiCache", "CPUUtilization"],
            [".", "NetworkBytesIn"],
            [".", "NetworkBytesOut"]
          ],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1",
          "title": "System Metrics"
        }
      }
    ]
  }'

# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name austa-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:austa-alerts

aws cloudwatch put-metric-alarm \
  --alarm-name austa-high-error-rate \
  --alarm-description "Alert when 5XX errors exceed 1%" \
  --metrics '[
    {
      "Id": "e1",
      "Expression": "m1/m2*100"
    },
    {
      "Id": "m1",
      "MetricStat": {
        "Metric": {
          "Namespace": "AWS/ApplicationELB",
          "MetricName": "HTTPCode_Target_5XX_Count",
          "Dimensions": [
            {
              "Name": "LoadBalancer",
              "Value": "app/austa-alb/xxxxx"
            }
          ]
        },
        "Period": 300,
        "Stat": "Sum"
      }
    },
    {
      "Id": "m2",
      "MetricStat": {
        "Metric": {
          "Namespace": "AWS/ApplicationELB",
          "MetricName": "RequestCount",
          "Dimensions": [
            {
              "Name": "LoadBalancer",
              "Value": "app/austa-alb/xxxxx"
            }
          ]
        },
        "Period": 300,
        "Stat": "Sum"
      }
    }
  ]' \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:austa-alerts
```

### 2. X-Ray Tracing

```bash
# Enable X-Ray for ECS tasks
aws ecs put-account-setting \
  --name awsvpcTrunking \
  --value enabled

# Add X-Ray sidecar to task definitions
{
  "name": "xray-daemon",
  "image": "public.ecr.aws/xray/aws-xray-daemon:latest",
  "cpu": 32,
  "memoryReservation": 256,
  "portMappings": [
    {
      "containerPort": 2000,
      "protocol": "udp"
    }
  ],
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/ecs/xray",
      "awslogs-region": "${AWS_REGION}",
      "awslogs-stream-prefix": "xray"
    }
  }
}
```

### 3. Application Performance Monitoring

```bash
# Install CloudWatch agent
# Add to Dockerfile
RUN wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm && \
    rpm -U ./amazon-cloudwatch-agent.rpm

# Configure custom metrics
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<EOF
{
  "metrics": {
    "namespace": "AUSTA/Application",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          {"name": "cpu_usage_idle", "rename": "CPU_IDLE", "unit": "Percent"},
          {"name": "cpu_usage_iowait", "rename": "CPU_IOWAIT", "unit": "Percent"}
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          {"name": "used_percent", "rename": "DISK_USED", "unit": "Percent"}
        ],
        "metrics_collection_interval": 60,
        "resources": ["/"]
      },
      "mem": {
        "measurement": [
          {"name": "mem_used_percent", "rename": "MEM_USED", "unit": "Percent"}
        ],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/www/backend/storage/logs/laravel.log",
            "log_group_name": "/aws/ecs/austa/application",
            "log_stream_name": "{instance_id}/laravel.log"
          }
        ]
      }
    }
  }
}
EOF
```

## Disaster Recovery

### 1. Backup Strategy

```bash
# Automated RDS backups
aws rds modify-db-instance \
  --db-instance-identifier austa-mysql-prod \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately

# Create manual snapshot before major changes
aws rds create-db-snapshot \
  --db-instance-identifier austa-mysql-prod \
  --db-snapshot-identifier austa-mysql-prod-$(date +%Y%m%d-%H%M%S)

# S3 cross-region replication
aws s3api put-bucket-replication \
  --bucket austa-documents \
  --replication-configuration '{
    "Role": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/s3-replication-role",
    "Rules": [
      {
        "ID": "ReplicateAll",
        "Priority": 1,
        "Status": "Enabled",
        "DeleteMarkerReplication": {"Status": "Enabled"},
        "Filter": {},
        "Destination": {
          "Bucket": "arn:aws:s3:::austa-documents-dr",
          "ReplicationTime": {
            "Status": "Enabled",
            "Time": {"Minutes": 15}
          },
          "Metrics": {
            "Status": "Enabled",
            "EventThreshold": {"Minutes": 15}
          },
          "StorageClass": "STANDARD_IA"
        }
      }
    ]
  }'
```

### 2. Recovery Procedures

```bash
# DR failover script
#!/bin/bash
DR_REGION="us-west-2"

# Promote RDS read replica
aws rds promote-read-replica \
  --db-instance-identifier austa-mysql-dr \
  --region ${DR_REGION}

# Update Route53 to point to DR region
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXX \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.austahealth.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "austa-alb-dr.us-west-2.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Scale up DR ECS services
aws ecs update-service \
  --cluster austa-production-dr \
  --service austa-backend \
  --desired-count 4 \
  --region ${DR_REGION}
```

## Cost Optimization

### 1. Reserved Capacity

```bash
# Purchase Reserved Instances for predictable workloads
aws ec2 purchase-reserved-instances-offering \
  --reserved-instances-offering-id xxxxxxxx \
  --instance-count 2

# RDS Reserved Instances
aws rds purchase-reserved-db-instances-offering \
  --reserved-db-instances-offering-id xxxxxxxx \
  --db-instance-count 1
```

### 2. Spot Instances for Non-Critical Workloads

```json
# ECS capacity provider for Spot instances
{
  "capacityProviders": [
    {
      "name": "FARGATE_SPOT",
      "weight": 4
    },
    {
      "name": "FARGATE",
      "weight": 1,
      "base": 2
    }
  ]
}
```

### 3. S3 Lifecycle Policies

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket austa-documents \
  --lifecycle-configuration '{
    "Rules": [
      {
        "Id": "ArchiveOldDocuments",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 30,
            "StorageClass": "STANDARD_IA"
          },
          {
            "Days": 90,
            "StorageClass": "GLACIER"
          }
        ]
      },
      {
        "Id": "DeleteOldLogs",
        "Status": "Enabled",
        "Expiration": {
          "Days": 90
        },
        "Filter": {
          "Prefix": "logs/"
        }
      }
    ]
  }'
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Container Health Check Failures

```bash
# Check container logs
aws ecs execute-command \
  --cluster austa-production \
  --task arn:aws:ecs:${AWS_REGION}:${AWS_ACCOUNT_ID}:task/xxxxx \
  --container backend \
  --interactive \
  --command "/bin/sh"

# Inside container
php artisan health:check --verbose
php artisan config:cache
php artisan route:cache
```

#### 2. Database Connection Issues

```bash
# Test connectivity from ECS task
aws ecs execute-command \
  --cluster austa-production \
  --task arn:aws:ecs:${AWS_REGION}:${AWS_ACCOUNT_ID}:task/xxxxx \
  --container backend \
  --interactive \
  --command "mysql -h austa-mysql-prod.xxxxx.rds.amazonaws.com -u admin -p"

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx \
  --query 'SecurityGroups[*].IpPermissions'
```

#### 3. Performance Issues

```bash
# Enable RDS Performance Insights
aws rds modify-db-instance \
  --db-instance-identifier austa-mysql-prod \
  --enable-performance-insights \
  --performance-insights-retention-period 7

# Check slow query log
aws rds download-db-log-file-portion \
  --db-instance-identifier austa-mysql-prod \
  --log-file-name slowquery/mysql-slowquery.log
```

#### 4. Auto-scaling Not Triggering

```bash
# Check scaling policies
aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id service/austa-production/austa-backend

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=austa-backend Name=ClusterName,Value=austa-production \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T01:00:00Z \
  --period 300 \
  --statistics Average
```

## CI/CD Pipeline

### GitHub Actions Deployment

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to AWS Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        run: |
          aws ecr get-login-password --region ${{ env.AWS_REGION }} | \
          docker login --username AWS --password-stdin ${{ env.ECR_REGISTRY }}

      - name: Build and push backend
        run: |
          docker build -t ${{ env.ECR_REGISTRY }}/austa/backend:${{ github.sha }} \
            --target production \
            -f backend/Dockerfile backend/
          docker push ${{ env.ECR_REGISTRY }}/austa/backend:${{ github.sha }}
          docker tag ${{ env.ECR_REGISTRY }}/austa/backend:${{ github.sha }} \
            ${{ env.ECR_REGISTRY }}/austa/backend:latest
          docker push ${{ env.ECR_REGISTRY }}/austa/backend:latest

      - name: Build and push frontend
        run: |
          docker build -t ${{ env.ECR_REGISTRY }}/austa/frontend:${{ github.sha }} \
            --build-arg NEXT_PUBLIC_API_URL=https://api.austahealth.com \
            -f frontend/Dockerfile frontend/
          docker push ${{ env.ECR_REGISTRY }}/austa/frontend:${{ github.sha }}
          docker tag ${{ env.ECR_REGISTRY }}/austa/frontend:${{ github.sha }} \
            ${{ env.ECR_REGISTRY }}/austa/frontend:latest
          docker push ${{ env.ECR_REGISTRY }}/austa/frontend:latest

      - name: Update ECS services
        run: |
          aws ecs update-service \
            --cluster austa-production \
            --service austa-backend \
            --force-new-deployment

          aws ecs update-service \
            --cluster austa-production \
            --service austa-frontend \
            --force-new-deployment

      - name: Wait for services to stabilize
        run: |
          aws ecs wait services-stable \
            --cluster austa-production \
            --services austa-backend austa-frontend
```

## Performance Optimization

### 1. CDN Configuration

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "austa-distribution-'$(date +%s)'",
    "Comment": "AUSTA Health Portal CDN",
    "DefaultRootObject": "index.html",
    "Origins": {
      "Quantity": 1,
      "Items": [
        {
          "Id": "austa-alb",
          "DomainName": "austa-alb.us-east-1.elb.amazonaws.com",
          "CustomOriginConfig": {
            "HTTPPort": 80,
            "HTTPSPort": 443,
            "OriginProtocolPolicy": "https-only",
            "OriginSslProtocols": {
              "Quantity": 3,
              "Items": ["TLSv1", "TLSv1.1", "TLSv1.2"]
            }
          }
        }
      ]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "austa-alb",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": {
        "Quantity": 7,
        "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
        "CachedMethods": {
          "Quantity": 2,
          "Items": ["GET", "HEAD"]
        }
      },
      "Compress": true,
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
    },
    "CacheBehaviors": {
      "Quantity": 2,
      "Items": [
        {
          "PathPattern": "/api/*",
          "TargetOriginId": "austa-alb",
          "ViewerProtocolPolicy": "https-only",
          "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
          "OriginRequestPolicyId": "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
        },
        {
          "PathPattern": "/_next/static/*",
          "TargetOriginId": "austa-alb",
          "ViewerProtocolPolicy": "https-only",
          "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
          "ResponseHeadersPolicyId": "60669652-455b-4ae9-85a4-c4c02393f86c"
        }
      ]
    },
    "CustomErrorResponses": {
      "Quantity": 2,
      "Items": [
        {
          "ErrorCode": 404,
          "ErrorCachingMinTTL": 60,
          "ResponseCode": 200,
          "ResponsePagePath": "/index.html"
        },
        {
          "ErrorCode": 403,
          "ErrorCachingMinTTL": 60,
          "ResponseCode": 200,
          "ResponsePagePath": "/index.html"
        }
      ]
    },
    "Enabled": true,
    "HttpVersion": "http2and3",
    "PriceClass": "PriceClass_All"
  }'
```

### 2. Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);

-- Partition large tables
ALTER TABLE audit_logs PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

## Compliance and Security Audit

### HIPAA Compliance Checklist

- [ ] Enable CloudTrail for all API calls
- [ ] Enable VPC Flow Logs
- [ ] Encrypt all data at rest (RDS, S3, EFS)
- [ ] Encrypt all data in transit (TLS 1.2+)
- [ ] Implement access logging for S3 buckets
- [ ] Configure AWS Config rules for compliance
- [ ] Enable GuardDuty for threat detection
- [ ] Implement AWS Security Hub
- [ ] Configure AWS Backup for automated backups
- [ ] Implement MFA for all IAM users
- [ ] Use AWS KMS for key management
- [ ] Configure AWS Organizations for account management
- [ ] Implement AWS SSO for centralized access
- [ ] Enable AWS Shield for DDoS protection
- [ ] Configure AWS Macie for data classification

### Security Scanning

```bash
# Run AWS Security Hub compliance check
aws securityhub get-compliance-summary \
  --standards-subscription-arns \
    arn:aws:securityhub:${AWS_REGION}:${AWS_ACCOUNT_ID}:subscription/aws-foundational-security-best-practices/v/1.0.0

# Run container vulnerability scanning
aws ecr describe-image-scan-findings \
  --repository-name austa/backend \
  --image-id imageTag=latest

# Run AWS Config compliance check
aws config describe-compliance-by-config-rule \
  --config-rule-names required-tags encrypted-volumes
```

## Conclusion

This comprehensive guide provides all technical details required for deploying the AUSTA Health Portal to AWS production infrastructure. The architecture ensures:

1. **High Availability**: Multi-AZ deployment with automatic failover
2. **Scalability**: Auto-scaling based on metrics with CloudFront CDN
3. **Security**: Multiple layers of security including WAF, encryption, and IAM
4. **Performance**: Optimized for low latency with caching and CDN
5. **Compliance**: HIPAA-ready infrastructure with audit trails
6. **Cost Optimization**: Mix of reserved and spot instances with lifecycle policies
7. **Disaster Recovery**: Automated backups with cross-region replication
8. **Observability**: Comprehensive monitoring with CloudWatch and X-Ray

### Next Steps

1. Review and customize configuration values for your environment
2. Set up AWS accounts and IAM roles
3. Configure DNS and SSL certificates
4. Deploy infrastructure using Terraform/CloudFormation
5. Run security audit and penetration testing
6. Configure backup and disaster recovery procedures
7. Set up monitoring dashboards and alerts
8. Document runbooks for operational procedures

### Support Resources

- AWS Well-Architected Framework: https://aws.amazon.com/architecture/well-architected/
- AWS Healthcare Compliance: https://aws.amazon.com/compliance/hipaa-compliance/
- ECS Best Practices: https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/
- RDS Best Practices: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html

For additional support, contact the AWS Solutions Architecture team or open a support ticket through the AWS Console.