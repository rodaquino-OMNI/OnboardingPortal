# TDD + DevOps Patterns for Healthcare Laravel/Next.js System

**Research Agent Report**
**Date:** 2025-09-30
**System:** AUSTA OnboardingPortal (Healthcare Compliance)
**Architecture:** Laravel 10 Modular Monolith + Next.js 13 SPA

---

## Executive Summary

This research analyzes battle-tested TDD and DevOps patterns for healthcare applications requiring HIPAA/LGPD compliance. Based on the existing ADR architecture (Modular Monolith with API-First Design, JWT Auth, MySQL with encryption), this report provides actionable recommendations for implementing production-ready TDD workflows and DevOps pipelines.

### Key Findings

1. **TDD Toolchain:** Pest PHP + React Testing Library + Playwright for E2E + OpenAPI contract testing
2. **Coverage Targets:** 85% overall, 90% critical paths (auth, PHI handling, payment)
3. **Security Gates:** SAST (Semgrep), DAST (OWASP ZAP), SCA (Trivy), Secrets (TruffleHog)
4. **DevOps Pattern:** Trunk-based development with feature flags + automated SBOM generation
5. **Infrastructure:** Terraform + AWS ECS Fargate (HIPAA-eligible) with encrypted RDS MySQL

---

## 1. TDD Patterns for Laravel + Next.js

### 1.1 Backend Testing Strategy (Laravel 10 + Pest PHP)

#### Why Pest Over PHPUnit?

| Criterion | Pest PHP | PHPUnit | Decision |
|-----------|----------|---------|----------|
| **Syntax** | Elegant, readable | Verbose, OOP | ✅ Pest - Better DX |
| **Speed** | Parallel execution | Sequential | ✅ Pest - 3-5x faster |
| **Laravel Integration** | First-class support | Standard | ✅ Pest - Native Laravel |
| **Coverage** | Built-in with --coverage | Requires Xdebug | ✅ Pest - Simpler setup |

**Recommended Testing Pyramid:**

```
                    E2E (10%)
                 ┌────────────┐
                 │  Playwright │  - Critical user journeys
                 │  (Browser)  │  - HIPAA compliance flows
                 └────────────┘
                       ▲
                       │
              Integration (30%)
           ┌─────────────────────┐
           │  API Contract Tests  │  - OpenAPI validation
           │  (Pest + HTTP Tests) │  - Auth flows
           └─────────────────────┘  - Multi-step onboarding
                       ▲
                       │
                Unit (60%)
        ┌──────────────────────────┐
        │    Pest PHP Unit Tests    │  - Business logic
        │    (Fast, Isolated)       │  - Encryption/decryption
        └──────────────────────────┘  - Risk scoring algorithms
```

#### Pest Configuration for Healthcare App

```php
// tests/Pest.php
<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class, WithFaker::class)->in('Feature');
uses(TestCase::class)->in('Unit');

// Global helpers for healthcare testing
function createPatientUser(array $attributes = []): User
{
    return User::factory()->patient()->create($attributes);
}

function createEncryptedBeneficiary(User $user, array $attributes = []): Beneficiary
{
    return Beneficiary::factory()->for($user)->create($attributes);
}

function assertPHIEncrypted(string $field, $model): void
{
    // Verify field is encrypted in database
    $rawValue = DB::table($model->getTable())
        ->where('id', $model->id)
        ->value($field);

    expect($rawValue)
        ->not->toBe($model->$field)
        ->and(strlen($rawValue))->toBeGreaterThan(strlen($model->$field));
}

// HIPAA audit log assertion
function assertAuditLogged(string $action, string $resourceType, int $resourceId): void
{
    expect(AuditLog::where('action', $action)
        ->where('resource_type', $resourceType)
        ->where('resource_id', $resourceId)
        ->exists()
    )->toBeTrue();
}
```

#### Example: Testing Field-Level Encryption (Critical Path)

```php
// tests/Feature/BeneficiaryEncryptionTest.php
<?php

use App\Models\User;
use App\Models\Beneficiary;
use Illuminate\Support\Facades\Crypt;

describe('Beneficiary PHI Encryption', function () {
    it('encrypts CPF before storing in database', function () {
        $user = createPatientUser();
        $cpf = '123.456.789-00';

        $beneficiary = Beneficiary::create([
            'user_id' => $user->id,
            'cpf' => $cpf,
            'full_name' => 'John Doe',
            'birth_date' => '1990-01-01',
            'biological_sex' => 'male',
        ]);

        // Assert CPF is encrypted in database
        assertPHIEncrypted('cpf', $beneficiary);

        // Assert decrypted value matches original
        expect($beneficiary->cpf)->toBe($cpf);

        // Assert hash is created for lookups
        expect($beneficiary->cpf_hash)->toBe(hash('sha256', $cpf));
    });

    it('prevents duplicate CPF using hash', function () {
        $user1 = createPatientUser(['email' => 'user1@test.com']);
        $user2 = createPatientUser(['email' => 'user2@test.com']);
        $cpf = '123.456.789-00';

        Beneficiary::create([
            'user_id' => $user1->id,
            'cpf' => $cpf,
            'full_name' => 'John Doe',
            'birth_date' => '1990-01-01',
            'biological_sex' => 'male',
        ]);

        // Attempt to create duplicate CPF
        expect(fn() => Beneficiary::create([
            'user_id' => $user2->id,
            'cpf' => $cpf,
            'full_name' => 'Jane Doe',
            'birth_date' => '1992-02-02',
            'biological_sex' => 'female',
        ]))->toThrow(\Illuminate\Database\QueryException::class);
    });

    it('logs PHI access to audit trail', function () {
        $user = createPatientUser();
        $beneficiary = createEncryptedBeneficiary($user);

        // Access PHI field (triggers audit log)
        $cpf = $beneficiary->cpf;

        assertAuditLogged('phi_accessed', 'beneficiary', $beneficiary->id);
    });
});
```

#### Coverage Requirements by Module

```php
// phpunit.xml (or pest.php)
<coverage processUncoveredFiles="true">
    <include>
        <directory suffix=".php">./app</directory>
    </include>
    <exclude>
        <directory>./app/Console</directory>
        <directory>./app/Http/Middleware</directory>
    </exclude>
    <report>
        <html outputDirectory="./coverage/html" lowUpperBound="70" highLowerBound="90"/>
        <clover outputFile="./coverage/clover.xml"/>
    </report>
</coverage>
```

**Minimum Coverage Thresholds:**
- **Authentication Module:** 95% (JWT, MFA, session management)
- **PHI Encryption:** 95% (field-level encryption, audit logging)
- **Health Questionnaire:** 90% (risk scoring, fraud detection)
- **Document Processing:** 85% (OCR, validation)
- **API Controllers:** 80% (endpoint logic)
- **Overall:** 85%

---

### 1.2 Frontend Testing Strategy (Next.js 13 + React Testing Library)

#### Why React Testing Library + Vitest?

| Tool | Purpose | Rationale |
|------|---------|-----------|
| **Vitest** | Unit tests | 10x faster than Jest, native ESM, Vite integration |
| **React Testing Library** | Component tests | Promotes accessibility, user-centric testing |
| **Playwright** | E2E tests | Cross-browser, HIPAA compliance flows, video recording |

#### Vitest Configuration for Next.js

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Critical paths require higher coverage
        './src/components/auth/**/*.tsx': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### Example: Testing Authentication Flow

```typescript
// tests/components/LoginForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/LoginForm';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post('/api/auth/login', (req, res, ctx) => {
    const { email, password } = req.body as any;

    if (email === 'valid@test.com' && password === 'ValidPass123!') {
      return res(
        ctx.status(200),
        ctx.json({
          access_token: 'mock_token',
          refresh_token: 'mock_refresh',
          expires_in: 900,
        })
      );
    }

    return res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LoginForm', () => {
  it('should successfully login with valid credentials', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);

    // Fill in form
    await user.type(screen.getByLabelText(/email/i), 'valid@test.com');
    await user.type(screen.getByLabelText(/password/i), 'ValidPass123!');

    // Submit form
    await user.click(screen.getByRole('button', { name: /login/i }));

    // Assert success callback called with token
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        access_token: 'mock_token',
        refresh_token: 'mock_refresh',
        expires_in: 900,
      });
    });
  });

  it('should display error for invalid credentials', async () => {
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'invalid@test.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    // Assert error message displayed
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('should enforce rate limiting after 5 failed attempts', async () => {
    const user = userEvent.setup();

    render(<LoginForm />);

    // Simulate 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await user.clear(screen.getByLabelText(/email/i));
      await user.clear(screen.getByLabelText(/password/i));
      await user.type(screen.getByLabelText(/email/i), 'test@test.com');
      await user.type(screen.getByLabelText(/password/i), 'wrong');
      await user.click(screen.getByRole('button', { name: /login/i }));
    }

    // 6th attempt should show rate limit error
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeDisabled();
  });
});
```

---

### 1.3 Contract Testing with OpenAPI

#### Why Contract Testing?

Healthcare APIs must maintain strict contracts for integration with:
- Mobile apps
- Third-party health plan systems
- Telemedicine providers
- Document processing services

**Recommended Tool:** `schemathesis` (Python) or `dredd` (Node.js)

#### OpenAPI Specification (contracts/api-v1.yaml)

```yaml
openapi: 3.0.3
info:
  title: AUSTA Onboarding Portal API
  version: 1.0.0
  description: Healthcare onboarding API with HIPAA compliance

servers:
  - url: https://api.austa-portal.com/v1
    description: Production
  - url: https://staging-api.austa-portal.com/v1
    description: Staging

paths:
  /auth/login:
    post:
      summary: Authenticate user
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 12
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                required: [access_token, refresh_token, expires_in]
                properties:
                  access_token:
                    type: string
                  refresh_token:
                    type: string
                  expires_in:
                    type: integer
        '401':
          description: Invalid credentials
        '429':
          description: Rate limit exceeded
```

#### Contract Testing with Schemathesis

```bash
# Install schemathesis
pip install schemathesis

# Run contract tests against staging API
schemathesis run \
  contracts/api-v1.yaml \
  --base-url https://staging-api.austa-portal.com/v1 \
  --checks all \
  --hypothesis-max-examples 100 \
  --workers 4 \
  --auth-type bearer \
  --auth "Bearer $STAGING_TOKEN" \
  --junit-xml reports/contract-tests.xml
```

**CI/CD Integration (GitHub Actions):**

```yaml
# .github/workflows/contract-tests.yml
- name: Run OpenAPI Contract Tests
  run: |
    pip install schemathesis
    schemathesis run \
      contracts/api-v1.yaml \
      --base-url ${{ secrets.STAGING_API_URL }} \
      --checks all \
      --junit-xml reports/contract-tests.xml
```

---

### 1.4 Mutation Testing for Critical Paths

**Why Mutation Testing?**
Traditional coverage metrics can give false confidence. Mutation testing verifies that tests actually detect bugs by introducing mutations (small code changes) and checking if tests fail.

**Recommended Tools:**
- **PHP:** Infection PHP
- **JavaScript/TypeScript:** Stryker

#### Infection PHP Configuration

```json
// infection.json.dist
{
    "source": {
        "directories": [
            "app/Services",
            "app/Models",
            "app/Http/Controllers/Api"
        ],
        "excludes": [
            "app/Console"
        ]
    },
    "timeout": 10,
    "logs": {
        "text": "infection.log",
        "summary": "infection-summary.log",
        "badge": {
            "branch": "main"
        }
    },
    "mutators": {
        "@default": true,
        "UnwrapArrayFilter": false
    },
    "minMsi": 85,
    "minCoveredMsi": 90
}
```

**Run mutation tests on critical modules:**

```bash
# Run mutation testing on authentication module
vendor/bin/infection \
  --filter=app/Services/AuthService.php \
  --min-msi=95 \
  --min-covered-msi=100 \
  --threads=4
```

---

## 2. DevOps Patterns for Healthcare Compliance

### 2.1 CI/CD Pipeline Architecture

**Trunk-Based Development with Feature Flags**

```
┌──────────────────────────────────────────────────────────────┐
│                    TRUNK-BASED WORKFLOW                       │
├──────────────────────────────────────────────────────────────┤
│  main branch (always deployable)                             │
│     │                                                         │
│     ├─ feature/health-questionnaire-v2 (short-lived)        │
│     │    └─ PR → CI → Merge to main (1-2 days max)          │
│     │                                                         │
│     ├─ feature/document-ocr-enhancement                      │
│     │    └─ PR → CI → Merge to main (1-2 days max)          │
│     │                                                         │
│     └─ main → Deploy to staging → Automated tests           │
│              └─ Deploy to prod (with feature flags)          │
└──────────────────────────────────────────────────────────────┘
```

**Feature Flag Implementation (LaunchDarkly pattern):**

```php
// config/features.php
return [
    'health_questionnaire_v2' => env('FEATURE_HEALTH_V2', false),
    'ocr_hybrid_mode' => env('FEATURE_OCR_HYBRID', false),
    'ai_risk_scoring' => env('FEATURE_AI_RISK', false),
];

// Usage in controller
public function store(Request $request)
{
    if (config('features.health_questionnaire_v2')) {
        return $this->storeV2($request);
    }

    return $this->storeV1($request);
}
```

---

### 2.2 Security Scanning Strategy

#### SAST (Static Application Security Testing)

**Tool:** Semgrep (supports PHP, JavaScript, TypeScript)

```yaml
# .semgrep.yml
rules:
  - id: hardcoded-credentials
    pattern: |
      password = "..."
    message: Hardcoded credentials detected
    severity: ERROR
    languages: [php, javascript, typescript]

  - id: sql-injection
    pattern: |
      DB::raw($USER_INPUT)
    message: Potential SQL injection
    severity: ERROR
    languages: [php]

  - id: xss-vulnerability
    pattern: |
      {!! $USER_INPUT !!}
    message: Unescaped user input (XSS risk)
    severity: ERROR
    languages: [php]

  - id: missing-phi-encryption
    pattern: |
      $beneficiary->cpf = $...;
    message: PHI field assignment without encryption
    severity: ERROR
    languages: [php]
```

**CI/CD Integration:**

```yaml
# .github/workflows/security-scan.yml (from existing workflow)
- name: Run Semgrep SAST
  uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/security-audit
      p/owasp-top-ten
      p/php-security
      p/javascript
      .semgrep.yml
    generateSarif: "1"

- name: Upload SARIF to GitHub Security
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: semgrep.sarif
```

#### DAST (Dynamic Application Security Testing)

**Tool:** OWASP ZAP (for healthcare-specific tests)

```yaml
# .github/workflows/dast-scan.yml
- name: Run OWASP ZAP Scan
  uses: zaproxy/action-full-scan@v0.7.0
  with:
    target: 'https://staging.austa-portal.com'
    rules_file_name: '.zap/rules.tsv'
    cmd_options: '-a -j -l WARN'
    issue_title: 'DAST Vulnerabilities Detected'
    token: ${{ secrets.GITHUB_TOKEN }}
```

**Healthcare-Specific ZAP Rules (.zap/rules.tsv):**

```
10016	WARN	(Web Browser XSS Protection Not Enabled)
10021	WARN	(X-Content-Type-Options Header Missing)
10023	WARN	(Information Disclosure - Debug Error Messages)
10035	WARN	(Strict-Transport-Security Header Not Set)
10040	FAIL	(Secure Pages Include Mixed Content)
10054	WARN	(Cookie Without SameSite Attribute)
10063	FAIL	(Permissions Policy Header Not Set)
10095	FAIL	(Backup File Disclosure)
10098	FAIL	(Cross-Domain Misconfiguration)
```

#### SCA (Software Composition Analysis)

**Tool:** Trivy (already in existing workflow)

**Enhanced configuration for healthcare:**

```yaml
- name: Run Trivy SCA with SBOM
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    format: 'cyclonedx'
    output: 'sbom.json'
    severity: 'CRITICAL,HIGH,MEDIUM'
    vuln-type: 'os,library'

- name: Upload SBOM to S3 (FDA Compliance)
  run: |
    aws s3 cp sbom.json s3://austa-compliance/sboms/$(date +%Y%m%d)-sbom.json
```

#### Secrets Detection

**Tool:** TruffleHog (already in workflow) + GitGuardian

```yaml
- name: TruffleHog Secrets Scan
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
    extra_args: --debug --only-verified --json --fail
```

---

### 2.3 Quality Gates & SLOs

#### Pre-Merge Quality Gates (GitHub Actions Branch Protection)

```yaml
# Required status checks before merge
required_status_checks:
  strict: true
  contexts:
    - "Backend Tests (85% coverage)"
    - "Frontend Tests (85% coverage)"
    - "Contract Tests (OpenAPI)"
    - "SAST (Semgrep) - No CRITICAL/HIGH"
    - "SCA (Trivy) - No CRITICAL"
    - "Secrets Scan - No leaks"
    - "Lighthouse CI - Performance >= 90"
    - "WCAG 2.1 AA Accessibility"

# Branch protection rules
branch_protection:
  required_pull_request_reviews:
    required_approving_review_count: 2
    dismiss_stale_reviews: true
    require_code_owner_reviews: true

  required_signatures: true
  enforce_admins: true
```

#### Service Level Objectives (SLOs)

| Metric | Target | Measurement | Action on Breach |
|--------|--------|-------------|------------------|
| **API Availability** | 99.9% uptime | CloudWatch Synthetics | Auto-rollback |
| **API Latency (p95)** | < 500ms | CloudWatch Metrics | Alert + investigation |
| **Error Rate** | < 0.1% | CloudWatch Logs Insights | Auto-scale + alert |
| **Test Suite Duration** | < 10 minutes | GitHub Actions metrics | Optimize parallel execution |
| **Deployment Frequency** | >= 5 per week | DORA metrics | Process review |
| **Mean Time to Recovery** | < 1 hour | Incident logs | Post-mortem |
| **Security Scan Failures** | 0 CRITICAL/HIGH | SARIF reports | Block deployment |

---

### 2.4 Infrastructure as Code (Terraform)

#### AWS ECS Fargate Reference Architecture (HIPAA-Eligible)

**File Structure:**
```
infra/terraform/
├── environments/
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── production/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars (encrypted)
├── modules/
│   ├── networking/
│   │   ├── vpc.tf
│   │   ├── security_groups.tf
│   │   └── outputs.tf
│   ├── ecs/
│   │   ├── cluster.tf
│   │   ├── service.tf
│   │   ├── task_definition.tf
│   │   └── autoscaling.tf
│   ├── rds/
│   │   ├── mysql.tf
│   │   ├── encryption.tf
│   │   └── backup.tf
│   └── monitoring/
│       ├── cloudwatch.tf
│       ├── alarms.tf
│       └── dashboards.tf
└── README.md
```

**Example: RDS MySQL with Encryption (HIPAA Requirement)**

```hcl
# modules/rds/mysql.tf
resource "aws_db_instance" "primary" {
  identifier     = "${var.environment}-austa-mysql"
  engine         = "mysql"
  engine_version = "8.0.35"
  instance_class = var.db_instance_class

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = "onboarding"
  username = "admin"
  password = random_password.db_password.result

  # HIPAA Requirements
  backup_retention_period = 35  # 35 days for HIPAA
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.environment}-austa-final-snapshot"

  # Encryption in Transit
  ca_cert_identifier = "rds-ca-rsa2048-g1"

  # Audit Logging
  enabled_cloudwatch_logs_exports = ["error", "general", "slowquery", "audit"]

  # Network Isolation
  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Performance Insights (HIPAA-eligible)
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn
  performance_insights_retention_period = 7

  tags = {
    Name        = "${var.environment}-austa-mysql"
    Environment = var.environment
    HIPAA       = "true"
    Compliance  = "LGPD"
    ManagedBy   = "Terraform"
  }
}

# KMS Key for RDS Encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption (${var.environment})"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${var.environment}-rds-encryption-key"
  }
}

# Read Replica for Scaling
resource "aws_db_instance" "replica" {
  count = var.enable_read_replica ? 1 : 0

  identifier     = "${var.environment}-austa-mysql-replica"
  replicate_source_db = aws_db_instance.primary.identifier

  instance_class = var.replica_instance_class

  # Inherit encryption from primary
  storage_encrypted = true

  # Separate AZ for high availability
  availability_zone = var.replica_az

  tags = {
    Name = "${var.environment}-austa-mysql-replica"
  }
}
```

**Example: ECS Fargate Task Definition (Backend)**

```hcl
# modules/ecs/task_definition.tf
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.environment}-austa-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"  # 1 vCPU
  memory                   = "2048"  # 2 GB

  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${var.ecr_repository_url}:${var.image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 8000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "APP_ENV"
          value = var.environment
        },
        {
          name  = "LOG_CHANNEL"
          value = "cloudwatch"
        }
      ]

      # Secrets from AWS Secrets Manager (HIPAA-compliant)
      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_password.arn}:password::"
        },
        {
          name      = "APP_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_key.arn}:key::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.jwt_secret.arn}:secret::"
        }
      ]

      # CloudWatch Logs
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}/austa-backend"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      # Health Check
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      # Resource Limits
      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = {
    Name        = "${var.environment}-austa-backend-task"
    Environment = var.environment
    HIPAA       = "true"
  }
}
```

#### Terraform CI/CD Pipeline

```yaml
# .github/workflows/terraform-deploy.yml
name: Terraform Infrastructure Deployment

on:
  push:
    branches: [main]
    paths:
      - 'infra/terraform/**'
  pull_request:
    paths:
      - 'infra/terraform/**'

jobs:
  terraform-plan:
    name: Terraform Plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Terraform Init
        working-directory: infra/terraform/environments/staging
        run: terraform init

      - name: Terraform Validate
        working-directory: infra/terraform/environments/staging
        run: terraform validate

      - name: Terraform Plan
        working-directory: infra/terraform/environments/staging
        run: terraform plan -out=tfplan

      - name: Upload Terraform Plan
        uses: actions/upload-artifact@v4
        with:
          name: terraform-plan
          path: infra/terraform/environments/staging/tfplan

  terraform-apply:
    name: Terraform Apply
    runs-on: ubuntu-latest
    needs: terraform-plan
    if: github.ref == 'refs/heads/main'
    environment:
      name: staging
    steps:
      - uses: actions/checkout@v4

      - name: Download Terraform Plan
        uses: actions/download-artifact@v4
        with:
          name: terraform-plan

      - name: Terraform Apply
        working-directory: infra/terraform/environments/staging
        run: terraform apply -auto-approve tfplan
```

---

## 3. SBOM Generation for Healthcare Compliance

**Why SBOM (Software Bill of Materials)?**

- FDA medical device software guidance recommends SBOM
- HIPAA audit trail for third-party dependencies
- Supply chain attack detection
- License compliance verification

**Tool:** Syft (Anchore)

```bash
# Generate SBOM in CycloneDX format
syft packages dir:. -o cyclonedx-json > sbom-cyclonedx.json

# Generate SBOM in SPDX format
syft packages dir:. -o spdx-json > sbom-spdx.json
```

**CI/CD Integration:**

```yaml
# .github/workflows/sbom-generation.yml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    path: ./
    format: cyclonedx-json
    output-file: sbom.json

- name: Upload SBOM to Release
  uses: actions/upload-release-asset@v1
  with:
    upload_url: ${{ github.event.release.upload_url }}
    asset_path: sbom.json
    asset_name: sbom-${{ github.ref_name }}.json
    asset_content_type: application/json

- name: Archive SBOM for Compliance
  run: |
    aws s3 cp sbom.json \
      s3://austa-compliance/sboms/$(date +%Y%m%d)-${{ github.sha }}.json \
      --server-side-encryption AES256
```

---

## 4. Accessibility Testing (WCAG 2.1 AA)

**Why Accessibility in Healthcare?**

- ADA compliance for US healthcare
- Inclusive design for elderly patients
- Screen reader compatibility for visually impaired

**Tool:** Axe-core (via Playwright)

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.1 AA Compliance', () => {
  test('Login page should have no accessibility violations', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Health questionnaire should be keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:3000/health-questionnaire');

    // Tab through all form fields
    await page.keyboard.press('Tab');
    await expect(page.locator('input:focus')).toHaveAttribute('name', 'age');

    await page.keyboard.press('Tab');
    await expect(page.locator('select:focus')).toHaveAttribute('name', 'biological_sex');

    // Submit form with Enter key
    await page.keyboard.press('Enter');
  });
});
```

**Lighthouse CI Configuration:**

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/login",
        "http://localhost:3000/onboarding"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

---

## 5. Recommended Toolchain Summary

### Backend Testing Stack

| Tool | Purpose | Version | Installation |
|------|---------|---------|--------------|
| **Pest PHP** | Unit + Feature tests | 2.x | `composer require pestphp/pest --dev` |
| **Laravel Dusk** | Browser tests (fallback) | 7.x | `composer require laravel/dusk --dev` |
| **Infection PHP** | Mutation testing | 0.27 | `composer require infection/infection --dev` |
| **PHPStan** | Static analysis | 1.10 | `composer require phpstan/phpstan --dev` |
| **PHP-CS-Fixer** | Code formatting | 3.x | `composer require friendsofphp/php-cs-fixer --dev` |

### Frontend Testing Stack

| Tool | Purpose | Version | Installation |
|------|---------|---------|--------------|
| **Vitest** | Unit tests | 1.0 | `npm i -D vitest @vitest/ui` |
| **React Testing Library** | Component tests | 14.x | `npm i -D @testing-library/react` |
| **Playwright** | E2E tests | 1.40 | `npm i -D @playwright/test` |
| **MSW** | API mocking | 2.0 | `npm i -D msw` |
| **Axe-core** | Accessibility tests | 4.8 | `npm i -D @axe-core/playwright` |

### DevOps & Security Stack

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Semgrep** | SAST | GitHub Action |
| **OWASP ZAP** | DAST | GitHub Action |
| **Trivy** | SCA + Container scan | GitHub Action |
| **TruffleHog** | Secrets detection | GitHub Action |
| **Syft** | SBOM generation | GitHub Action |
| **Terraform** | IaC | `brew install terraform` |

---

## 6. Quality Gate Thresholds

### Critical Path Coverage Requirements

```yaml
coverage_thresholds:
  authentication:
    minimum: 95%
    critical_files:
      - app/Services/AuthService.php
      - app/Http/Controllers/Api/AuthController.php
      - app/Http/Middleware/UnifiedAuthMiddleware.php

  phi_encryption:
    minimum: 95%
    critical_files:
      - app/Models/Beneficiary.php
      - app/Services/EncryptionService.php

  health_assessment:
    minimum: 90%
    critical_files:
      - app/Services/HealthAIService.php
      - app/Http/Controllers/Api/HealthQuestionnaireController.php

  payment_processing:
    minimum: 95%
    critical_files:
      - app/Services/RewardDeliveryService.php
      - app/Models/UserReward.php

  overall:
    minimum: 85%
```

### Performance Budgets

```json
{
  "performance_budgets": {
    "lighthouse": {
      "performance": 90,
      "accessibility": 95,
      "best-practices": 90,
      "seo": 90
    },
    "api_latency": {
      "p50": "200ms",
      "p95": "500ms",
      "p99": "1000ms"
    },
    "frontend": {
      "first_contentful_paint": "1.5s",
      "largest_contentful_paint": "2.5s",
      "time_to_interactive": "3.0s",
      "total_blocking_time": "200ms",
      "cumulative_layout_shift": 0.1
    }
  }
}
```

---

## 7. References & Industry Standards

### Healthcare-Specific Standards

1. **HIPAA Security Rule** - Technical Safeguards
   https://www.hhs.gov/hipaa/for-professionals/security/index.html

2. **FDA Software Validation Guidance**
   https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-principles-software-validation

3. **NIST Cybersecurity Framework (Healthcare)**
   https://www.nist.gov/cyberframework/healthcare

4. **LGPD (Brazilian Data Protection Law)**
   https://lgpd-brazil.info/

### TDD Best Practices

5. **Laravel Testing Best Practices**
   https://laravel.com/docs/10.x/testing

6. **React Testing Library Principles**
   https://testing-library.com/docs/guiding-principles/

7. **Contract Testing with OpenAPI**
   https://swagger.io/docs/specification/about/

### DevOps & Security

8. **OWASP Top 10 (Healthcare)**
   https://owasp.org/www-project-top-ten/

9. **CIS Benchmarks for Docker & Kubernetes**
   https://www.cisecurity.org/cis-benchmarks/

10. **AWS HIPAA Compliance Whitepaper**
    https://docs.aws.amazon.com/whitepapers/latest/architecting-hipaa-security-and-compliance-on-aws/

---

## 8. Next Steps & Action Items

### Immediate Actions (Week 1-2)

1. ✅ **Setup Pest PHP** - Migrate existing PHPUnit tests to Pest
2. ✅ **Configure Vitest** - Setup frontend testing environment
3. ✅ **Generate OpenAPI Spec** - Document all API endpoints
4. ✅ **Setup Semgrep** - Add SAST to CI/CD pipeline
5. ✅ **Create Terraform Modules** - VPC, RDS, ECS boilerplate

### Short-Term (Week 3-6)

6. **Achieve 85% Coverage** - Write missing unit tests for critical paths
7. **Setup Contract Tests** - Integrate Schemathesis with staging API
8. **DAST Integration** - Add OWASP ZAP to nightly builds
9. **SBOM Automation** - Generate SBOM on every release
10. **Lighthouse CI** - Enforce performance budgets

### Medium-Term (Month 2-3)

11. **Mutation Testing** - Achieve 85% MSI on critical modules
12. **E2E Test Suite** - Playwright tests for complete user journeys
13. **Infrastructure Provisioning** - Deploy staging environment with Terraform
14. **Accessibility Audit** - WCAG 2.1 AA compliance verification
15. **Load Testing** - k6 or Locust for 100k concurrent users

---

## Conclusion

This research provides a production-ready TDD and DevOps strategy aligned with the existing ADR architecture decisions. The recommended toolchain prioritizes:

- **Speed:** Pest PHP (3-5x faster), Vitest (10x faster), parallel CI/CD
- **Security:** Multi-layer scanning (SAST, DAST, SCA, secrets)
- **Compliance:** HIPAA/LGPD requirements (encryption, audit logs, SBOM)
- **Quality:** 85% coverage baseline, 95% for critical paths, mutation testing
- **Maintainability:** Trunk-based development, feature flags, IaC

**Key Metrics to Track:**
- Test coverage: 85% overall, 95% critical paths
- CI/CD duration: < 10 minutes
- Deployment frequency: >= 5 per week
- MTTR: < 1 hour
- Security scan failures: 0 CRITICAL/HIGH

**Estimated Implementation Timeline:** 6-8 weeks for full stack deployment

---

**Researcher:** Claude Code Research Agent
**Date:** 2025-09-30
**Next Review:** 2025-10-14
