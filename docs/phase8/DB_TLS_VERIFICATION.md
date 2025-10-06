# Database TLS/SSL Connection Verification Guide

**Document Version:** 1.0  
**Effective Date:** 2025-10-06  
**Implements:** ADR-004: Encryption in Transit  
**Compliance:** LGPD, HIPAA, PCI-DSS

---

## 1. Overview

This document provides comprehensive verification procedures for ensuring all database connections use TLS/SSL encryption. Database connections MUST be encrypted to protect PHI/PII data in transit.

## 2. TLS Configuration

### 2.1 Laravel Database Configuration

**File:** `config/database.php`

**MySQL TLS Configuration:**
```php
'mysql' => [
    'driver' => 'mysql',
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '3306'),
    'database' => env('DB_DATABASE'),
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),

    // TLS/SSL Options (ADR-004 compliance)
    'options' => extension_loaded('pdo_mysql') ? array_filter([
        // CA Certificate (Certificate Authority)
        PDO::MYSQL_ATTR_SSL_CA => env('DB_SSL_CA', false) ?: null,

        // Client Certificate (for mutual TLS)
        PDO::MYSQL_ATTR_SSL_CERT => env('DB_SSL_CERT', false) ?: null,

        // Client Private Key
        PDO::MYSQL_ATTR_SSL_KEY => env('DB_SSL_KEY', false) ?: null,

        // SSL Cipher Suite
        PDO::MYSQL_ATTR_SSL_CIPHER => env('DB_SSL_CIPHER', false) ?: null,

        // Verify Server Certificate (REQUIRED for production)
        PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => env('DB_SSL_VERIFY', true),

        // Performance optimizations
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]) : [],
],
```

### 2.2 Environment Variables

**Production `.env` Configuration:**
```env
# Database Connection
DB_CONNECTION=mysql
DB_HOST=production-db.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=onboarding_prod
DB_USERNAME=prod_user
DB_PASSWORD=${AWS_SECRETS_MANAGER:db_password}

# TLS/SSL Configuration (REQUIRED for production)
DB_SSL_CA=/etc/ssl/certs/rds-ca-2019-root.pem
DB_SSL_CERT=/etc/ssl/certs/client-cert.pem
DB_SSL_KEY=/etc/ssl/private/client-key.pem
DB_SSL_VERIFY=true
```

## 3. Certificate Management

### 3.1 AWS RDS CA Certificate

**Download AWS RDS Root Certificate:**
```bash
# Download latest RDS CA bundle
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -O /etc/ssl/certs/rds-ca-bundle.pem

# Or specific region certificate
wget https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem -O /etc/ssl/certs/rds-ca-us-east-1.pem
```

**Update `.env` Configuration:**
```env
DB_SSL_CA=/etc/ssl/certs/rds-ca-bundle.pem
```

## 4. Verification Procedures

### 4.1 Command-Line Verification

**Test MySQL Connection with TLS:**
```bash
# Connect with TLS and verify
mysql -h production-db.us-east-1.rds.amazonaws.com \
  -u prod_user \
  -p \
  --ssl-ca=/etc/ssl/certs/rds-ca-bundle.pem \
  --ssl-verify-server-cert \
  -e "SHOW STATUS LIKE 'Ssl_cipher';"

# Expected output:
# +---------------+--------------------+
# | Variable_name | Value              |
# +---------------+--------------------+
# | Ssl_cipher    | TLS_AES_256_GCM... |
# +---------------+--------------------+
```

### 4.2 Laravel Artisan Verification

**Create Verification Command:**
```php
<?php
// app/Console/Commands/VerifyDatabaseTLS.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class VerifyDatabaseTLS extends Command
{
    protected $signature = 'db:verify-tls';
    protected $description = 'Verify database connection uses TLS/SSL encryption';

    public function handle()
    {
        try {
            // Check TLS cipher
            $result = DB::select("SHOW STATUS LIKE 'Ssl_cipher'");
            $cipher = $result[0]->Value ?? null;

            if (empty($cipher)) {
                $this->error('❌ Database connection is NOT encrypted!');
                return 1;
            }

            $this->info("✅ Database connection is encrypted");
            $this->info("Cipher: {$cipher}");

            // Check TLS version
            $result = DB::select("SHOW STATUS LIKE 'Ssl_version'");
            $version = $result[0]->Value ?? null;
            $this->info("TLS Version: {$version}");

            return 0;
        } catch (\Exception $e) {
            $this->error("❌ Error verifying TLS: {$e->getMessage()}");
            return 1;
        }
    }
}
```

**Run Verification:**
```bash
php artisan db:verify-tls
```

## 5. Automated Testing

**PHPUnit Test:**
```php
<?php
// tests/Feature/Security/DatabaseTLSTest.php

namespace Tests\Feature\Security;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseTLSTest extends TestCase
{
    /**
     * @test
     * @group security
     */
    public function database_connection_uses_tls_encryption()
    {
        // Query TLS cipher
        $result = DB::select("SHOW STATUS LIKE 'Ssl_cipher'");
        $cipher = $result[0]->Value ?? null;

        $this->assertNotEmpty($cipher, 'Database connection MUST use TLS/SSL encryption');
        $this->assertStringContainsString('TLS', $cipher, 'Cipher must use TLS protocol');
    }

    /**
     * @test
     * @group security
     */
    public function database_uses_minimum_tls_version()
    {
        // Query TLS version
        $result = DB::select("SHOW STATUS LIKE 'Ssl_version'");
        $version = $result[0]->Value ?? null;

        // Require TLS 1.2 or higher
        $validVersions = ['TLSv1.2', 'TLSv1.3'];
        $this->assertContains($version, $validVersions,
            'TLS version must be 1.2 or higher');
    }
}
```

## 6. Troubleshooting

### 6.1 Common Issues

**Issue: "SSL connection error: Failed to set up SSL"**

**Cause:** CA certificate not found or invalid

**Solution:**
```bash
# Download latest RDS CA certificate
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -O /tmp/rds-ca.pem

# Verify certificate
openssl x509 -in /tmp/rds-ca.pem -text -noout

# Update .env
DB_SSL_CA=/tmp/rds-ca.pem
```

## 7. Compliance Checklist

### 7.1 Production Readiness

- [ ] TLS/SSL enabled on database server
- [ ] `DB_SSL_CA` configured with valid CA certificate
- [ ] `DB_SSL_VERIFY=true` in production environment
- [ ] Minimum TLS version 1.2 enforced
- [ ] Strong cipher suites configured
- [ ] Certificate expiration monitoring enabled
- [ ] Automated TLS verification in CI/CD
- [ ] PHPUnit tests for TLS configuration
- [ ] Documentation updated

## 8. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-06 | Security Team | Initial document |

---

**Document Owner:** DevOps & Security Teams  
**Review Cycle:** Quarterly  
**Next Review:** 2026-01-06

**Related Documents:**
- [Encryption Policy](./ENCRYPTION_POLICY.md)
- [Key Management Policy](./KEY_MANAGEMENT_POLICY.md)

---

*This guide ensures all database connections use TLS/SSL encryption in compliance with LGPD, HIPAA, and PCI-DSS requirements.*
