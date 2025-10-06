# Field-Level Encryption Policy

**Document Version:** 1.0
**Effective Date:** 2025-10-06
**Implements:** ADR-004: Field-Level Encryption for PHI/PII
**Compliance:** LGPD, HIPAA (if applicable), ISO 27001

---

## 1. Overview

This document defines the comprehensive field-level encryption policy for the Onboarding Portal system. All Protected Health Information (PHI) and Personally Identifiable Information (PII) MUST be encrypted at rest using AES-256-GCM encryption.

## 2. Scope

### 2.1 Covered Data Elements

The following data elements MUST be encrypted at the field level:

| Data Element | Category | Encryption Required | Hash Required | Rationale |
|-------------|----------|---------------------|---------------|-----------|
| CPF (Brazilian Tax ID) | PII | ✅ Yes | ✅ Yes | Unique identifier, searchable |
| Birthdate | PII | ✅ Yes | ❌ No | Date of birth, PHI |
| Phone Number | PII | ✅ Yes | ✅ Yes | Contact info, searchable |
| Address | PII | ✅ Yes | ❌ No | Location data, complex object |
| Medical Records | PHI | ✅ Yes | ❌ No | Health information |
| Health Questionnaire | PHI | ✅ Yes | ❌ No | Health assessment data |

### 2.2 Covered Tables

- `users` - User authentication and profile data
- `beneficiaries` - Healthcare beneficiary information
- `health_questionnaires` - Medical assessment data
- `documents` - Uploaded documents (file encryption separate)

## 3. Technical Implementation

### 3.1 Encryption Algorithm

**Primary Algorithm:** AES-256-GCM (Galois/Counter Mode)

**Implementation:** Laravel Crypt facade with OpenSSL backend

**Key Characteristics:**
- **Block Cipher:** AES (Advanced Encryption Standard)
- **Key Length:** 256 bits
- **Mode:** GCM (authenticated encryption)
- **Authentication Tag:** 128 bits
- **IV Length:** 96 bits (random per encryption)

**Security Properties:**
- ✅ Confidentiality (encryption)
- ✅ Integrity (authentication tag)
- ✅ Semantic security (random IV)
- ✅ FIPS 140-2 compliant
- ✅ NIST approved

### 3.2 Key Management

**Master Key Storage:**
```env
# .env (NEVER commit to repository)
APP_KEY=base64:YOUR_256_BIT_KEY_HERE

# Key generation command:
php artisan key:generate --show
```

**Key Properties:**
- **Key Length:** 256 bits (32 bytes)
- **Key Format:** Base64-encoded
- **Key Rotation:** Quarterly (every 90 days)
- **Key Storage:** Environment variables, AWS Secrets Manager (production)

**Access Control:**
- Master key accessible only to application runtime
- No key hardcoding in source code
- No key transmission over unsecured channels
- Audit all key access attempts

### 3.3 Hash Generation for Searchable Fields

**Algorithm:** SHA-256 (one-way hash)

**Purpose:** Enable efficient lookups on encrypted fields without decryption

**Implementation:**
```php
// Generate hash for CPF lookup
$cpfHash = hash('sha256', $cpf);

// Query by hash (no decryption needed)
$user = User::where('cpf_hash', $cpfHash)->first();
```

**Hash Properties:**
- **Algorithm:** SHA-256
- **Output Length:** 256 bits (64 hex characters)
- **Collision Resistance:** 2^128 operations
- **Pre-image Resistance:** Computationally infeasible
- **Use Case:** Unique constraints, efficient lookups

## 4. Application-Level Implementation

### 4.1 EncryptsAttributes Trait

**Location:** `app/Traits/EncryptsAttributes.php`

**Usage in Models:**
```php
<?php

namespace App\Models;

use App\Traits\EncryptsAttributes;

class User extends Model
{
    use EncryptsAttributes;

    protected $encrypted = ['cpf', 'birthdate', 'phone', 'address'];
    protected $hashed = ['cpf' => 'cpf_hash', 'phone' => 'phone_hash'];
}
```

**Automatic Behavior:**
- ✅ Encryption on `setAttribute()` (before save)
- ✅ Decryption on `getAttribute()` (after load)
- ✅ Hash generation on mutation
- ✅ Graceful error handling
- ✅ Audit logging

### 4.2 Example Operations

**Create User (Auto-Encrypt):**
```php
$user = User::create([
    'email' => 'user@example.com',
    'cpf' => '12345678900',      // Automatically encrypted
    'phone' => '11999999999',     // Automatically encrypted
]);
// Database stores encrypted BLOB + SHA-256 hash
```

**Read User (Auto-Decrypt):**
```php
$user = User::find(1);
echo $user->cpf;  // Automatically decrypted: "12345678900"
```

**Search by Encrypted Field (Hash Lookup):**
```php
// Efficient lookup using hash (no decryption)
$user = User::findByEncrypted('cpf', '12345678900');

// Query scope
$users = User::whereEncrypted('phone', '11999999999')->get();
```

## 5. Compliance Requirements

### 5.1 LGPD (Lei Geral de Proteção de Dados)

**Article 6, VI - Security Principle:**
- ✅ Technical measures to protect personal data
- ✅ Encryption of sensitive personal data
- ✅ Access control and audit logging

**Article 46 - Security Safeguards:**
- ✅ Encryption of personal data
- ✅ Confidentiality and integrity controls
- ✅ Regular testing of security measures

### 5.2 HIPAA (if applicable)

**164.312(a)(2)(iv) - Encryption and Decryption:**
- ✅ Implement mechanism to encrypt PHI
- ✅ AES-256 meets NIST standards
- ✅ Audit controls for access

### 5.3 ISO 27001

**A.10.1.1 - Cryptographic Controls:**
- ✅ Policy on use of cryptographic controls
- ✅ Key management procedures
- ✅ Regular review and testing

## 6. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-06 | Security Team | Initial policy creation |

---

**Document Owner:** Security Team
**Review Cycle:** Quarterly
**Next Review:** 2026-01-06

**Related Documents:**
- [ADR-004: Field-Level Encryption](../ARCHITECTURE_DECISIONS.md#adr-004)
- [Key Management Policy](./KEY_MANAGEMENT_POLICY.md)
- [Database TLS Verification](./DB_TLS_VERIFICATION.md)

---

*This policy implements state-of-the-art field-level encryption for PHI/PII protection in compliance with LGPD, HIPAA, and ISO 27001 standards.*
