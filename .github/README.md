# OnboardingPortal CI/CD Pipeline

This directory contains the complete CI/CD pipeline configuration for the OnboardingPortal project, implementing industry best practices for automated testing, security scanning, and deployment.

## 🚀 Pipeline Overview

The CI/CD pipeline consists of three main workflows:

### 1. **CI Pipeline** (`workflows/ci.yml`)
Comprehensive testing and quality assurance pipeline that runs on every push and pull request.

**Pipeline Stages:**
- **Backend Testing & Analysis**
  - PHP 8.2 with MySQL 8.0 and Redis 7.0
  - PHPUnit tests with coverage reporting
  - PHP CodeSniffer (PSR-12 standards)
  - PHPStan static analysis (Level 5)
  - Database migrations and seeders

- **Frontend Testing & Analysis**
  - Node.js 18 with TypeScript
  - Jest unit tests with coverage
  - ESLint linting
  - TypeScript type checking
  - Accessibility testing (pa11y)

- **End-to-End Testing**
  - Playwright E2E tests
  - Multi-browser testing (Chromium, Firefox, WebKit)
  - Full application stack testing with Docker Compose

- **Security Scanning**
  - Snyk vulnerability scanning (Backend & Frontend)
  - GitHub CodeQL analysis
  - SAST (Static Application Security Testing)

- **Docker Build & Registry**
  - Multi-stage Docker builds
  - GitHub Container Registry (GHCR)
  - Multi-platform builds (AMD64, ARM64)
  - Optimized caching strategies

- **Performance Testing**
  - Lighthouse CI for frontend performance
  - Backend performance tests
  - Load testing on main branch

### 2. **Production Deployment** (`workflows/production-deploy.yml`)
Blue-Green deployment strategy with automatic rollback capabilities.

**Deployment Features:**
- **Pre-deployment Checks**
  - Docker image verification
  - Environment readiness validation
  - Dependency verification

- **Blue-Green Deployment**
  - Zero-downtime deployments
  - Automatic traffic switching
  - Health checks and monitoring
  - Rollback capabilities

- **Post-deployment Verification**
  - Comprehensive health checks
  - Integration testing
  - Performance validation
  - Security verification

- **Monitoring & Notifications**
  - Slack notifications
  - Email alerts
  - Status page updates
  - Incident response integration

### 3. **Security Scanning** (`workflows/security-scan.yml`)
Comprehensive security scanning pipeline with daily scheduled runs.

**Security Features:**
- **Dependency Vulnerability Scanning**
  - npm audit (Frontend)
  - Composer security advisories (Backend)
  - Snyk security scanning
  - Automated reporting

- **Static Application Security Testing (SAST)**
  - GitHub CodeQL analysis
  - SemGrep security rules
  - OWASP security patterns
  - Custom security rules

- **Container Security**
  - Trivy vulnerability scanner
  - Docker image security analysis
  - Base image vulnerability detection
  - SARIF reporting integration

- **Secret Scanning**
  - TruffleHog secret detection
  - GitLeaks secret scanning
  - Historical commit scanning
  - Verified secret detection

- **Infrastructure Security**
  - Checkov IaC security scanning
  - Dockerfile security analysis
  - GitHub Actions security review
  - Infrastructure compliance

- **Web Application Security**
  - OWASP ZAP baseline scanning
  - Full security scanning (scheduled)
  - Dynamic security testing
  - Penetration testing automation

## 🐳 Docker Configuration

### Multi-stage Dockerfiles
- **Backend Dockerfile** (`omni-portal/backend/Dockerfile`)
  - Dependencies stage for optimized caching
  - Builder stage for application compilation
  - Production stage with minimal attack surface
  - Development stage with debugging tools

- **Frontend Dockerfile** (`omni-portal/frontend/Dockerfile`)
  - Multi-stage build for optimized bundle size
  - Static file serving optimization
  - Security hardening
  - Performance optimizations

### Docker Compose Configurations
- **CI Environment** (`docker-compose.ci.yml`)
  - Optimized for testing environments
  - Parallel test execution
  - Security scanning integration
  - Performance testing setup

- **Production Environment** (Referenced in docker-compose.prod.yml)
  - Blue-Green deployment support
  - Load balancing configuration
  - Health check endpoints
  - Monitoring integration

## 📋 Required Secrets

Configure the following secrets in your GitHub repository:

### Container Registry
```bash
GITHUB_TOKEN  # Automatically provided by GitHub
```

### Security Scanning
```bash
SNYK_TOKEN              # Snyk API token
SEMGREP_APP_TOKEN       # SemGrep API token (optional)
```

### Deployment
```bash
SLACK_WEBHOOK           # Slack notifications
SECURITY_SLACK_WEBHOOK  # Security alerts
EMAIL_NOTIFICATIONS     # Email notification addresses
```

### Performance Testing
```bash
LHCI_GITHUB_APP_TOKEN   # Lighthouse CI token (optional)
```

## 🛠️ Usage Instructions

### Running CI Pipeline
The CI pipeline automatically runs on:
- Push to `main`, `develop`, or `feature/*` branches
- Pull requests to `main` or `develop` branches

### Manual Deployment
Use the deployment script for manual deployments:

```bash
# Deploy to staging
.github/scripts/deploy.sh staging

# Deploy specific version to production
.github/scripts/deploy.sh production -v v1.2.3

# Rollback production deployment
.github/scripts/deploy.sh production --rollback
```

### Security Scanning
Security scans run automatically:
- **Daily**: Comprehensive security scan at 2 AM UTC
- **On Push**: Basic security checks on every commit
- **On PR**: Security analysis for code changes

### Manual Security Scan
Trigger manual security scan:
```bash
gh workflow run security-scan.yml
```

## 📊 Monitoring & Metrics

### Code Coverage
- Backend: PHPUnit coverage reports
- Frontend: Jest coverage reports
- Combined coverage uploaded to Codecov

### Performance Metrics
- Lighthouse performance scores
- Core Web Vitals tracking
- Backend response time monitoring
- Database query performance

### Security Metrics
- Vulnerability detection and tracking
- Dependency security status
- Container security posture
- Web application security score

## 🔧 Configuration Files

### Key Configuration Files
- `.github/workflows/ci.yml` - Main CI pipeline
- `.github/workflows/production-deploy.yml` - Production deployment
- `.github/workflows/security-scan.yml` - Security scanning
- `.github/docker-compose.ci.yml` - CI environment setup
- `.github/scripts/deploy.sh` - Deployment automation script

### Docker Configurations
- `omni-portal/backend/Dockerfile` - Backend container
- `omni-portal/frontend/Dockerfile` - Frontend container
- `omni-portal/docker/nginx/ci.conf` - Nginx configuration
- `omni-portal/backend/docker/` - PHP and supervisor configs

## 🚨 Troubleshooting

### Common Issues

**Build Failures:**
- Check Docker image compatibility
- Verify dependency versions
- Review build logs for specific errors

**Test Failures:**
- Ensure database migrations are current
- Check test environment configuration
- Review test output for specific failures

**Deployment Issues:**
- Verify secrets configuration
- Check deployment environment status
- Review deployment logs

**Security Scan Failures:**
- Review vulnerability reports
- Update dependencies with known vulnerabilities
- Check security configuration compliance

### Getting Help
1. Check GitHub Actions logs for detailed error information
2. Review the troubleshooting section in this README
3. Contact the development team for support
4. Check project documentation for additional guidance

## 🎯 Best Practices

### Development Workflow
1. Create feature branch from `develop`
2. Implement changes with tests
3. Create pull request to `develop`
4. Address CI feedback and security findings
5. Merge to `develop` after approval
6. Deploy to staging for integration testing
7. Merge to `main` for production deployment

### Security Guidelines
1. Regularly update dependencies
2. Address security vulnerabilities promptly
3. Follow secure coding practices
4. Review security scan results
5. Implement security feedback

### Performance Optimization
1. Monitor Lighthouse scores
2. Optimize Docker image sizes
3. Implement caching strategies
4. Monitor database performance
5. Track Core Web Vitals

---

This CI/CD pipeline provides enterprise-grade automation for the OnboardingPortal project, ensuring code quality, security, and reliable deployments.