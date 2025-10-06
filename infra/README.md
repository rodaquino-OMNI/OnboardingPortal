# OmniPortal Infrastructure

Production-grade AWS infrastructure with HIPAA compliance, automated CI/CD, and comprehensive security.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet Gateway                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS WAF + ALB                           │
│                    (SSL/TLS Termination)                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌──────────────────┐           ┌──────────────────┐
    │  ECS Fargate     │           │  ECS Fargate     │
    │  (API Service)   │           │  (API Service)   │
    │  Multi-AZ        │           │  Multi-AZ        │
    └──────────────────┘           └──────────────────┘
              │                               │
    ┌─────────┴───────────────────────────────┴─────────┐
    │                                                     │
    ▼                                                     ▼
┌──────────────────┐                         ┌──────────────────┐
│  RDS MySQL 8.0   │                         │ ElastiCache      │
│  (Multi-AZ)      │                         │ Redis Cluster    │
│  + Read Replica  │                         │ (Multi-AZ)       │
│  TDE Enabled     │                         │ TLS Enabled      │
└──────────────────┘                         └──────────────────┘
         │                                            │
         └────────────────┬───────────────────────────┘
                          ▼
                 ┌─────────────────┐
                 │  S3 Buckets     │
                 │  (Encrypted)    │
                 │  - Documents    │
                 │  - Assets       │
                 │  - Logs         │
                 │  - Backups      │
                 └─────────────────┘
```

## Features

### Security (HIPAA Compliant per ADR-004)
- **Encryption at Rest**: KMS encryption for RDS, Redis, S3, CloudWatch Logs
- **Encryption in Transit**: TLS 1.2+ for all connections
- **Key Rotation**: Automatic KMS key rotation enabled
- **WAF Protection**: AWS WAF with managed rule sets (SQL injection, XSS, rate limiting)
- **Secrets Management**: AWS Secrets Manager for credentials
- **Network Security**: Private subnets, security groups, NACLs

### High Availability
- **Multi-AZ Deployment**: RDS and Redis in multiple availability zones
- **Auto Scaling**: ECS services with CPU/Memory-based scaling
- **Load Balancing**: Application Load Balancer with health checks
- **Disaster Recovery**: Cross-region backup replication (production)

### Monitoring & Observability
- **CloudWatch Dashboards**: Real-time metrics and visualizations
- **Alarms**: CPU, memory, latency, error rate monitoring
- **Audit Logs**: 7-year retention for HIPAA compliance
- **Enhanced Monitoring**: RDS Performance Insights, ECS Container Insights

### CI/CD Pipeline
- **Quality Gates**: 85% coverage threshold, mutation testing
- **Security Scanning**: SAST (Semgrep), dependency audit (Grype), IaC scan (tfsec/Checkov)
- **SBOM Generation**: CycloneDX and SPDX formats
- **Automated Deployment**: Dev → Staging (canary) → Production (blue/green)
- **Auto-Rollback**: Automatic rollback on SLO breach (error rate >1%, P95 >500ms)

## Quick Start

### Prerequisites

```bash
# Install Terraform
brew install terraform

# Install AWS CLI
brew install awscli

# Install tfsec and Checkov for IaC scanning
brew install tfsec
pip install checkov

# Configure AWS credentials
aws configure
```

### Deploy Infrastructure

1. **Create S3 backend (one-time setup)**

```bash
cd infra/terraform

# Create state bucket and DynamoDB table
aws s3 mb s3://omni-portal-terraform-state-dev --region us-east-1
aws s3api put-bucket-versioning --bucket omni-portal-terraform-state-dev --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket omni-portal-terraform-state-dev --server-side-encryption-configuration '{
  "Rules": [{
    "ApplyServerSideEncryptionByDefault": {
      "SSEAlgorithm": "aws:kms"
    }
  }]
}'

aws dynamodb create-table \
  --table-name omni-portal-terraform-locks-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

2. **Initialize Terraform**

```bash
cd environments/dev
terraform init -backend-config=backend.tfvars
```

3. **Plan and Apply**

```bash
# Review changes
terraform plan -var-file=terraform.tfvars -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

### Deploy Application

The CI/CD pipeline automatically deploys on push to `main` branch. Manual deployment:

```bash
# Trigger deployment
gh workflow run monolith.yml
```

## CI/CD Pipeline

### Pipeline Stages

1. **Prepare** - Version generation, cache setup
2. **Quality** (parallel)
   - Lint (ESLint, PHP CS Fixer)
   - TypeScript type checking
3. **Unit Tests** - 85% coverage threshold
4. **Mutation Tests** - 75% MSI requirement
5. **Integration Tests** - With MySQL and Redis containers
6. **Build** - Docker image with multi-stage build
7. **Security** (parallel)
   - SBOM generation (CycloneDX, SPDX)
   - SAST scanning (Semgrep)
   - Dependency audit (Grype)
   - IaC scanning (tfsec, Checkov)
8. **Package** - Deployment artifacts
9. **Deploy Dev** - Automated deployment
10. **E2E Tests (Dev)** - Playwright tests
11. **Canary Staging** - 10% traffic with monitoring
12. **E2E Tests (Staging)** - Full integration tests
13. **Production** - Manual approval + auto-rollback

### Quality Gates

**Fail Conditions:**
- Code coverage < 85%
- SAST high/critical findings
- Secrets detected in code
- CVEs in dependencies
- IaC security violations

**Auto-Rollback Triggers:**
- Error rate > 1%
- P95 latency > 500ms

## SBOM Generation

Generate Software Bill of Materials:

```bash
cd sbom
./generate.sh
```

Outputs:
- `cyclonedx.json` - CycloneDX SBOM
- `spdx.json` - SPDX SBOM
- `vulnerabilities.json` - Vulnerability scan results
- `licenses.txt` - License analysis
- `sbom-report.md` - Summary report

## Infrastructure Modules

### Core Modules
- **vpc** - VPC with public/private subnets, NAT gateway, flow logs
- **security** - KMS keys, Secrets Manager, Security Groups, WAF
- **rds** - MySQL 8.0 with encryption, Multi-AZ, read replica
- **redis** - ElastiCache cluster with encryption, Multi-AZ
- **s3** - Encrypted buckets with versioning and lifecycle policies
- **ecs** - Fargate services with auto-scaling
- **alb** - Application Load Balancer with SSL/TLS
- **monitoring** - CloudWatch dashboards, alarms, log groups

### Security Features (ADR-004 Compliance)

**Database Encryption:**
```hcl
storage_encrypted                   = true
kms_key_id                         = module.security.rds_kms_key_arn
iam_database_authentication_enabled = true
```

**TLS Enforcement:**
```hcl
parameter {
  name  = "require_secure_transport"
  value = "ON"
}
```

**Key Rotation:**
```hcl
enable_key_rotation = true
```

## Disaster Recovery

### Backup Strategy
- **RDS**: Automated daily backups, 30-day retention (prod)
- **Redis**: Daily snapshots, 7-day retention (prod)
- **S3**: Versioning enabled, Glacier transition after 90 days
- **Cross-Region**: Automated replication to us-west-2 (prod)

### Recovery Procedures

**Database Restore:**
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier omni-portal-restored \
  --db-snapshot-identifier prod-snapshot-YYYYMMDD-HHMM \
  --region us-east-1
```

**Redis Restore:**
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id omni-portal-restored \
  --snapshot-name omni-portal-snapshot-YYYYMMDD \
  --region us-east-1
```

## Monitoring & Alerts

### CloudWatch Dashboard
Access: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards

**Metrics:**
- API request rate, latency (P50, P95, P99)
- ECS CPU/memory utilization
- RDS connections, throughput, IOPS
- Redis cache hit rate, evictions
- ALB target health, 5xx errors

### Alerts (SNS)
- High error rate (>1%)
- High latency (P95 >500ms)
- Database CPU >80%
- Low disk space
- Unhealthy targets

## Security Compliance

### HIPAA Requirements Met
✅ Encryption at rest (KMS)
✅ Encryption in transit (TLS 1.2+)
✅ Audit logging (CloudWatch)
✅ 7-year log retention
✅ Access controls (IAM, Security Groups)
✅ Multi-factor authentication (IAM)
✅ Automated backup and recovery
✅ Network isolation (VPC, private subnets)

### Security Scanning
- **SAST**: Semgrep with OWASP Top 10 rules
- **Dependency Scan**: Grype with CVE database
- **IaC Scan**: tfsec + Checkov for Terraform
- **Container Scan**: Trivy for Docker images
- **Secret Detection**: git-secrets, TruffleHog

## Cost Optimization

### Development Environment
- **Estimated Monthly Cost**: ~$200-300
- db.t3.medium RDS: ~$50
- cache.t3.small Redis: ~$20
- ECS Fargate (512 CPU): ~$30
- ALB: ~$20
- Data transfer: ~$10-50

### Production Environment
- **Estimated Monthly Cost**: ~$800-1200
- db.r6g.xlarge RDS Multi-AZ: ~$400
- cache.r6g.large Redis: ~$150
- ECS Fargate (2048 CPU x 3): ~$200
- ALB: ~$30
- Data transfer: ~$50-100

### Cost Reduction Tips
- Use Reserved Instances for RDS (save 40-60%)
- Enable S3 Intelligent-Tiering
- Set up CloudWatch Logs retention policies
- Use Spot instances for non-critical workloads

## Troubleshooting

### Common Issues

**Terraform State Lock:**
```bash
# Release lock
aws dynamodb delete-item \
  --table-name omni-portal-terraform-locks-dev \
  --key '{"LockID":{"S":"omni-portal-dev/infrastructure/terraform.tfstate"}}'
```

**ECS Task Failures:**
```bash
# View task logs
aws logs tail /aws/ecs/omni-portal-dev/api --follow
```

**Database Connection Issues:**
```bash
# Test connectivity from ECS
aws ecs execute-command \
  --cluster omni-portal-dev \
  --task TASK_ID \
  --container omni-portal-api \
  --interactive \
  --command "mysql -h $DB_HOST -u $DB_USER -p"
```

## Contributing

1. Create feature branch
2. Run `terraform fmt` and `terraform validate`
3. Run security scans: `tfsec . && checkov -d .`
4. Submit PR with infrastructure changes
5. Pipeline runs automatically on PR

## Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **On-Call**: PagerDuty alerts to oncall@example.com

## License

Proprietary - OmniPortal Internal Use Only
