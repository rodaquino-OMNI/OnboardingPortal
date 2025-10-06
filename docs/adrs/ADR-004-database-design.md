# ADR-004: Database Design and Data Encryption Strategy

**Status:** Accepted
**Date:** 2025-09-30
**Decision Makers:** Lead Architect, Database Architect, Security Officer
**Consulted:** Compliance Team, Development Team

---

## Context

The AUSTA OnboardingPortal handles sensitive Protected Health Information (PHI) and Personally Identifiable Information (PII) requiring robust database design with encryption. We need to make decisions about:

1. **Database Engine**: Relational vs NoSQL
2. **Schema Design**: Normalized vs denormalized
3. **Encryption Strategy**: At-rest, in-transit, field-level
4. **Performance**: Indexing, caching, query optimization
5. **Scalability**: Replication, sharding, partitioning

### Requirements
- **Compliance**: HIPAA and LGPD compliant data storage
- **Performance**: < 100ms query time (p95)
- **Scalability**: Support 100,000+ active users
- **Durability**: 99.999999999% (11 nines) data durability
- **Security**: Field-level encryption for PHI/PII

---

## Decision

**We will use MySQL 8.0 with field-level encryption for PHI, transparent data encryption for the entire database, and read replicas for scaling.**

This includes:
1. **MySQL 8.0** as primary database engine
2. **AES-256-GCM** field-level encryption for sensitive fields (CPF, phone, address)
3. **Transparent Data Encryption (TDE)** for entire database at rest
4. **TLS 1.3** for all database connections
5. **Primary-Replica Architecture** for read scaling
6. **Automated Backups** with point-in-time recovery

---

## Rationale

### Why MySQL 8.0?

| Advantage | Impact |
|-----------|--------|
| **ACID Compliance** | Critical for healthcare and financial data integrity |
| **JSON Support** | Flexible schema for evolving health questionnaire data |
| **Window Functions** | Complex analytics for admin dashboard |
| **CTE (Common Table Expressions)** | Readable complex queries for reporting |
| **Transparent Data Encryption** | Built-in encryption at rest (HIPAA requirement) |
| **Mature Ecosystem** | 25+ years of production use, large community |
| **Laravel Integration** | Native Eloquent ORM support, migrations |
| **AWS RDS Support** | Managed service with automated backups, patching |

### Why Field-Level Encryption?

```sql
-- Sensitive PHI fields encrypted at application layer
CREATE TABLE beneficiaries (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    -- Encrypted Fields (AES-256-GCM)
    cpf VARBINARY(255) NOT NULL,           -- Encrypted CPF (SSN equivalent)
    phone VARBINARY(255) NOT NULL,         -- Encrypted phone number
    address JSON NULL,                      -- Encrypted address JSON

    -- Searchable Fields (hashed for lookups)
    cpf_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash for uniqueness checks
    phone_hash VARCHAR(64) NOT NULL,       -- SHA-256 hash for lookups

    -- Non-Sensitive Fields (plaintext for queries)
    full_name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    biological_sex ENUM('male', 'female') NOT NULL,

    -- Indexes
    INDEX idx_cpf_hash (cpf_hash),
    INDEX idx_phone_hash (phone_hash),
    INDEX idx_birth_date (birth_date),
    FULLTEXT idx_name_search (full_name)
);
```

**Rationale:**
- HIPAA requires PHI to be encrypted at rest
- Field-level encryption provides granular control
- Hashed fields enable uniqueness checks without decryption
- Application-level encryption gives key rotation flexibility

---

## Alternatives Considered

### Alternative 1: PostgreSQL 15

**Pros:**
- Advanced JSON capabilities (JSONB)
- Better full-text search
- PostGIS for geospatial queries
- More standard SQL compliance

**Cons:**
- Less Laravel Eloquent optimization
- Smaller community in healthcare space
- Less AWS RDS optimization
- **Decision:** ❌ Rejected - MySQL better ecosystem for Laravel

### Alternative 2: MongoDB (NoSQL)

**Pros:**
- Flexible schema
- Horizontal scalability
- Native JSON storage

**Cons:**
- No ACID transactions (multi-document)
- Healthcare industry prefers relational for auditability
- Difficult to enforce data integrity
- Complex query language learning curve
- **Decision:** ❌ Rejected - ACID compliance critical for healthcare

### Alternative 3: Amazon Aurora MySQL

**Pros:**
- MySQL compatible
- Auto-scaling storage
- Fast read replicas
- Better performance

**Cons:**
- Vendor lock-in to AWS
- Higher cost (3-5x standard RDS)
- Complex pricing model
- **Decision:** ⚠️ Consider for Phase 2 if performance demands require it

### Alternative 4: Database-Level Encryption Only (TDE)

**Pros:**
- Simpler implementation
- No application changes
- Transparent to application

**Cons:**
- Full database decrypted in memory (security risk)
- Cannot have granular access control
- Does not protect against insider threats
- **Decision:** ❌ Rejected - Insufficient for HIPAA PHI protection

---

## Database Schema Design

### Core Tables

```sql
-- Users (Authentication)
CREATE TABLE users (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email_verified_at TIMESTAMP NULL,

    -- Two-Factor Authentication
    two_factor_secret TEXT NULL,
    two_factor_recovery_codes TEXT NULL,
    two_factor_confirmed_at TIMESTAMP NULL,

    -- Session Management
    remember_token VARCHAR(100) NULL,
    last_login_at TIMESTAMP NULL,
    login_count INT UNSIGNED DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_email (email),
    INDEX idx_active_users (is_active, last_login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Beneficiaries (Patient Profiles)
CREATE TABLE beneficiaries (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    -- Encrypted PHI
    cpf VARBINARY(255) NOT NULL,
    phone VARBINARY(255) NOT NULL,
    address JSON NULL,

    -- Hashed for lookups
    cpf_hash VARCHAR(64) NOT NULL UNIQUE,
    phone_hash VARCHAR(64) NOT NULL,

    -- Plaintext (non-sensitive)
    full_name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    biological_sex ENUM('male', 'female') NOT NULL,
    emergency_contact JSON NULL,

    -- Onboarding Progress
    onboarding_step ENUM('registration', 'profile', 'health', 'documents', 'interview', 'completed') DEFAULT 'registration',
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    completed_at TIMESTAMP NULL,

    -- Privacy Compliance
    lgpd_consent_given BOOLEAN DEFAULT FALSE,
    lgpd_consent_date TIMESTAMP NULL,
    data_retention_until DATE NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_user (user_id),
    INDEX idx_cpf_hash (cpf_hash),
    INDEX idx_phone_hash (phone_hash),
    INDEX idx_onboarding (onboarding_step, completion_percentage),
    INDEX idx_completed (completed_at),
    FULLTEXT idx_name_search (full_name),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Health Questionnaires
CREATE TABLE health_questionnaires (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    beneficiary_id BIGINT UNSIGNED NOT NULL,

    -- Questionnaire Data
    pathway_type ENUM('basic', 'comprehensive') NOT NULL,
    responses JSON NOT NULL, -- Encrypted responses

    -- Risk Assessment
    risk_score DECIMAL(5,2) NULL, -- 0-100
    risk_category ENUM('low', 'moderate', 'high', 'critical') NULL,
    emergency_detected BOOLEAN DEFAULT FALSE,

    -- AI Analysis
    ai_insights JSON NULL,
    clinical_recommendations JSON NULL,

    -- Completion Status
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    completed_at TIMESTAMP NULL,

    -- Fraud Detection
    completion_time_seconds INT UNSIGNED NULL,
    fraud_flags JSON NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_beneficiary (beneficiary_id),
    INDEX idx_risk_category (risk_category),
    INDEX idx_emergency (emergency_detected, created_at),
    INDEX idx_completed (completed_at),

    FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documents
CREATE TABLE documents (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    beneficiary_id BIGINT UNSIGNED NOT NULL,

    -- Document Metadata
    document_type ENUM('identity_card', 'cpf', 'proof_of_residence', 'medical_certificate', 'other') NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL UNIQUE,
    file_size INT UNSIGNED NOT NULL, -- bytes
    mime_type VARCHAR(100) NOT NULL,

    -- Storage
    storage_path VARCHAR(500) NOT NULL, -- S3 bucket path

    -- OCR Processing
    ocr_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    ocr_provider ENUM('aws_textract', 'tesseract', 'hybrid') NULL,
    ocr_confidence DECIMAL(5,2) NULL, -- 0-100
    ocr_extracted_data JSON NULL,

    -- Validation
    validation_status ENUM('pending', 'approved', 'rejected', 'requires_review') DEFAULT 'pending',
    validation_errors JSON NULL,

    -- Fraud Detection
    fraud_score DECIMAL(5,2) NULL, -- 0-100
    fraud_flags JSON NULL,

    -- Approval
    approved_by BIGINT UNSIGNED NULL,
    approved_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_beneficiary_type (beneficiary_id, document_type),
    INDEX idx_ocr_status (ocr_status, created_at),
    INDEX idx_validation_status (validation_status),
    INDEX idx_approval (approved_by, approved_at),

    FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gamification Progress
CREATE TABLE gamification_progress (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    beneficiary_id BIGINT UNSIGNED NOT NULL UNIQUE,

    -- Points & Levels
    total_points INT UNSIGNED DEFAULT 0,
    current_level VARCHAR(20) DEFAULT 'iniciante',
    level_progress DECIMAL(5,2) DEFAULT 0.00, -- % to next level

    -- Badges
    earned_badges JSON DEFAULT '[]',
    achievement_timestamps JSON DEFAULT '{}',

    -- Engagement Tracking
    streak_days INT UNSIGNED DEFAULT 0,
    longest_streak INT UNSIGNED DEFAULT 0,
    sessions_count INT UNSIGNED DEFAULT 0,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Analytics
    completion_rate DECIMAL(5,2) DEFAULT 100.00,
    average_session_duration INT UNSIGNED DEFAULT 0, -- seconds

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_beneficiary (beneficiary_id),
    INDEX idx_level_points (current_level, total_points),
    INDEX idx_last_activity (last_activity),

    FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HIPAA Audit Logs
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

    -- WHO
    user_id BIGINT UNSIGNED NULL,
    user_role VARCHAR(50) NULL,
    session_id VARCHAR(255) NOT NULL,

    -- WHAT
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id BIGINT UNSIGNED NULL,
    changes JSON NULL, -- Before/after values

    -- WHEN
    occurred_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),

    -- WHERE
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    geolocation JSON NULL,

    -- HOW
    request_method VARCHAR(10) NULL,
    request_url VARCHAR(500) NULL,
    response_status INT NULL,

    -- COMPLIANCE
    phi_accessed BOOLEAN DEFAULT FALSE,
    minimum_necessary BOOLEAN DEFAULT TRUE,
    authorized_disclosure BOOLEAN DEFAULT TRUE,
    risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',

    -- Indexes
    INDEX idx_user_action (user_id, action, occurred_at),
    INDEX idx_phi_access (phi_accessed, occurred_at),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_risk_level (risk_level, occurred_at),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Encryption Implementation

### Field-Level Encryption (Laravel)

```php
// app/Models/Beneficiary.php
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Crypt;

class Beneficiary extends Model
{
    protected $fillable = ['cpf', 'phone', 'address', /* ... */];

    /**
     * Encrypt CPF before saving, decrypt when retrieving
     */
    protected function cpf(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ? Crypt::decryptString($value) : null,
            set: function ($value) {
                return [
                    'cpf' => Crypt::encryptString($value),
                    'cpf_hash' => hash('sha256', $value), // For uniqueness checks
                ];
            }
        );
    }

    /**
     * Encrypt phone before saving, decrypt when retrieving
     */
    protected function phone(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ? Crypt::decryptString($value) : null,
            set: function ($value) {
                return [
                    'phone' => Crypt::encryptString($value),
                    'phone_hash' => hash('sha256', $value),
                ];
            }
        );
    }

    /**
     * Encrypt address JSON
     */
    protected function address(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ? json_decode(Crypt::decryptString($value), true) : null,
            set: fn ($value) => Crypt::encryptString(json_encode($value))
        );
    }
}
```

### Transparent Data Encryption (MySQL)

```sql
-- Enable TDE for entire tablespace
ALTER TABLESPACE innodb_system ENCRYPTION='Y';

-- Verify encryption status
SELECT
    TABLESPACE_NAME,
    ENCRYPTION
FROM INFORMATION_SCHEMA.INNODB_TABLESPACES
WHERE TABLESPACE_NAME = 'innodb_system';
```

### Connection Encryption (TLS 1.3)

```php
// config/database.php
'mysql' => [
    'driver' => 'mysql',
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '3306'),
    'database' => env('DB_DATABASE', 'onboarding'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix' => '',
    'strict' => true,
    'engine' => 'InnoDB',

    // TLS Connection
    'options' => [
        PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
        PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => true,
        PDO::MYSQL_ATTR_SSL_CIPHER => 'TLS_AES_256_GCM_SHA384',
    ],
],
```

---

## Performance Optimization

### Indexing Strategy

```sql
-- Composite Indexes for Common Queries
CREATE INDEX idx_onboarding_progress ON beneficiaries (onboarding_step, completion_percentage, created_at);
CREATE INDEX idx_health_risk ON health_questionnaires (beneficiary_id, risk_category, completed_at);
CREATE INDEX idx_document_validation ON documents (beneficiary_id, validation_status, document_type);

-- Covering Indexes (Include all columns in SELECT)
CREATE INDEX idx_user_dashboard ON beneficiaries (user_id, onboarding_step)
    INCLUDE (completion_percentage, created_at);

-- Full-Text Indexes for Search
CREATE FULLTEXT INDEX idx_beneficiary_search ON beneficiaries (full_name);
CREATE FULLTEXT INDEX idx_audit_search ON audit_logs (action, resource_type);
```

### Query Optimization

```php
// ❌ BAD: N+1 Query Problem
$beneficiaries = Beneficiary::all();
foreach ($beneficiaries as $beneficiary) {
    echo $beneficiary->user->email; // Triggers additional query per beneficiary
}

// ✅ GOOD: Eager Loading
$beneficiaries = Beneficiary::with('user')->get();
foreach ($beneficiaries as $beneficiary) {
    echo $beneficiary->user->email; // No additional queries
}

// ✅ BETTER: Select Only Required Columns
$beneficiaries = Beneficiary::with('user:id,email')
    ->select('id', 'user_id', 'full_name', 'onboarding_step')
    ->get();
```

### Caching Strategy

```php
// Cache frequently accessed data
public function getUserDashboard(int $userId): array
{
    return Cache::remember("user_dashboard:{$userId}", 300, function () use ($userId) {
        return Beneficiary::where('user_id', $userId)
            ->with(['gamificationProgress', 'healthQuestionnaire'])
            ->first();
    });
}

// Invalidate cache on update
public function updateBeneficiary(Beneficiary $beneficiary, array $data): void
{
    $beneficiary->update($data);

    // Clear cache
    Cache::forget("user_dashboard:{$beneficiary->user_id}");
}
```

---

## Consequences

### Positive

- ✅ **ACID Compliance**: Guaranteed data integrity for healthcare data
- ✅ **Field-Level Encryption**: PHI protected even if database compromised
- ✅ **Performance**: Indexed queries < 100ms p95
- ✅ **Scalability**: Read replicas support 100,000+ users
- ✅ **Backup & Recovery**: Automated backups with point-in-time recovery
- ✅ **Compliance**: Meets HIPAA and LGPD requirements

### Negative

- ⚠️ **Encryption Overhead**: Field-level encryption adds 10-20ms per query
- ⚠️ **Search Limitations**: Cannot search on encrypted fields directly
- ⚠️ **Key Management**: Encryption keys must be securely managed

### Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Encryption Key Loss** | Low | Critical | - AWS KMS for key management<br>- Key backup to secure offline storage<br>- Key rotation procedures |
| **Database Performance Degradation** | Medium | High | - Read replicas for scaling<br>- Query optimization<br>- Redis caching layer |
| **Data Breach** | Low | Critical | - Field-level encryption<br>- Network isolation (VPC)<br>- IP whitelisting |
| **Backup Restoration Failure** | Low | Critical | - Monthly backup restoration drills<br>- Automated backup verification<br>- Cross-region backups |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Query Performance (p95)** | < 100ms | CloudWatch RDS metrics |
| **Read Replica Lag** | < 1 second | MySQL replication monitoring |
| **Cache Hit Rate** | > 80% | Redis INFO stats |
| **Backup Success Rate** | 100% | AWS RDS backup monitoring |
| **Encryption Overhead** | < 20ms | Application performance monitoring |

---

## References

- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)
- [HIPAA Database Security Requirements](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Laravel Encryption](https://laravel.com/docs/10.x/encryption)
- [AWS RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)

---

## Approval

| Role | Name | Decision | Date | Signature |
|------|------|----------|------|-----------|
| **Lead Architect** | [Name] | Approved | 2025-09-30 | ✓ |
| **Database Architect** | [Name] | Approved | 2025-09-30 | ✓ |
| **Security Officer** | [Name] | Approved | 2025-09-30 | ✓ |
| **Compliance Officer** | [Name] | Approved | 2025-09-30 | ✓ |

---

**Next Steps:**
1. Set up AWS RDS MySQL 8.0 instance with TDE
2. Implement field-level encryption in Laravel models
3. Configure read replicas for scaling
4. Set up automated backup and restoration procedures
5. Implement query performance monitoring
6. Create database migration scripts
7. Document encryption key rotation procedures
