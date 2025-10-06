# Encryption Key Management Policy

**Document Version:** 1.0  
**Effective Date:** 2025-10-06  
**Implements:** ADR-004: Field-Level Encryption - Key Management  
**Compliance:** NIST SP 800-57, ISO 27001, LGPD

---

## 1. Overview

This document defines the comprehensive key management policy for encryption keys used in the Onboarding Portal system. Proper key management is CRITICAL for maintaining the security of encrypted PHI/PII data.

## 2. Key Hierarchy

### 2.1 Master Application Key (APP_KEY)

**Purpose:** Primary encryption key for Laravel Crypt facade

**Properties:**
- **Algorithm:** AES-256
- **Key Length:** 256 bits (32 bytes)
- **Format:** Base64-encoded string
- **Example:** `base64:RANDOM_32_BYTES_BASE64_ENCODED`

**Usage:**
- Encrypts all sensitive user data (cpf, birthdate, phone, address)
- Used by Laravel Crypt::encryptString() / Crypt::decryptString()
- Single key encrypts ALL application data

**Security Requirements:**
- MUST be randomly generated using cryptographically secure RNG
- MUST be unique per environment (dev, staging, production)
- MUST be stored in environment variables, NEVER in source code
- MUST be backed up separately from database backups
- MUST be rotated every 90 days

## 3. Key Generation

### 3.1 Master Application Key Generation

**Command:**
```bash
# Generate new APP_KEY
php artisan key:generate --show

# Output: base64:RANDOM_32_BYTES_BASE64_ENCODED
```

**Manual Generation (if needed):**
```php
<?php
// Generate 32 random bytes and base64 encode
$key = 'base64:' . base64_encode(random_bytes(32));
echo $key;
```

**Requirements:**
- Use PHP's `random_bytes()` function (cryptographically secure)
- Never use `rand()`, `mt_rand()`, or predictable sources
- Verify key length is exactly 32 bytes before encoding

## 4. Key Storage

### 4.1 Development Environment

**Storage Method:** Environment file (`.env`)

**Configuration:**
```env
# .env (NEVER commit to Git)
APP_KEY=base64:DEVELOPMENT_KEY_HERE

# Database TLS keys
DB_SSL_CA=/path/to/ca-cert.pem
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
```

**Security Measures:**
- Add `.env` to `.gitignore`
- Use `.env.example` template without actual keys
- Restrict file permissions: `chmod 600 .env`

### 4.2 Production Environment

**Storage Method:** AWS Secrets Manager

**Secret Structure:**
```json
{
  "APP_KEY": "base64:PRODUCTION_KEY_HERE",
  "DB_SSL_CA": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "DB_SSL_CERT": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "DB_SSL_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
}
```

**Security Measures:**
- Enable automatic rotation (every 90 days)
- Use IAM policies for least-privilege access
- Enable CloudTrail logging for audit
- Encrypt secrets at rest with AWS KMS

## 5. Key Rotation

### 5.1 Rotation Schedule

**Master Application Key:**
- **Frequency:** Every 90 days (quarterly)
- **Trigger Events:**
  - Scheduled rotation
  - Key compromise suspected
  - Employee termination (with key access)
  - Security audit recommendation

### 5.2 Application Key Rotation Procedure

**Step 1: Generate New Key**
```bash
php artisan key:generate --show > new-app-key.txt
```

**Step 2: Create Re-encryption Command**
```php
<?php
// app/Console/Commands/RotateEncryptionKey.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Encryption\Encrypter;

class RotateEncryptionKey extends Command
{
    protected $signature = 'encrypt:rotate-key
                            {--old-key= : Old APP_KEY}
                            {--new-key= : New APP_KEY}';

    public function handle()
    {
        $oldKey = $this->option('old-key');
        $newKey = $this->option('new-key');

        // Create encrypters
        $oldEncrypter = new Encrypter(base64_decode(substr($oldKey, 7)), 'AES-256-CBC');
        $newEncrypter = new Encrypter(base64_decode(substr($newKey, 7)), 'AES-256-CBC');

        // Re-encrypt users
        DB::table('users')->orderBy('id')->chunk(100, function ($users) use ($oldEncrypter, $newEncrypter) {
            foreach ($users as $user) {
                $updates = [];

                if ($user->cpf) {
                    $decrypted = $oldEncrypter->decryptString($user->cpf);
                    $updates['cpf'] = $newEncrypter->encryptString($decrypted);
                }

                // ... repeat for other encrypted fields

                if (!empty($updates)) {
                    DB::table('users')->where('id', $user->id)->update($updates);
                }
            }
        });

        $this->info('Key rotation completed successfully');
    }
}
```

**Step 3: Execute Rotation**
```bash
# Set maintenance mode
php artisan down

# Run re-encryption
php artisan encrypt:rotate-key \
  --old-key="$(cat old-app-key.txt)" \
  --new-key="$(cat new-app-key.txt)"

# Update environment variable
aws secretsmanager update-secret \
  --secret-id onboarding-portal/production \
  --secret-string "{\"APP_KEY\":\"$(cat new-app-key.txt)\"}"

# Restart application
php artisan up
php artisan config:cache
```

## 6. Access Control

### 6.1 Who Can Access Keys

**Production Master Key (APP_KEY):**
- ✅ Application runtime (via AWS Secrets Manager)
- ✅ DevOps lead (break-glass access, logged)
- ✅ Security team (audit access, logged)
- ❌ Developers (no direct access)
- ❌ Database administrators (no access)

**Development Master Key:**
- ✅ All developers (local `.env` file)
- ⚠️ NEVER use production keys in development

## 7. Compliance

### 7.1 NIST SP 800-57 Compliance

**Key Management Lifecycle:**
- ✅ Key generation (cryptographically secure RNG)
- ✅ Key storage (encrypted at rest with KMS)
- ✅ Key distribution (AWS Secrets Manager)
- ✅ Key usage (AES-256-GCM encryption)
- ✅ Key rotation (every 90 days)
- ✅ Key destruction (secure deletion after rotation)

### 7.2 ISO 27001 Compliance

**A.10.1.2 - Key Management:**
- ✅ Documented key management policy
- ✅ Access control and audit logging
- ✅ Regular key rotation procedures
- ✅ Secure key storage and backup

## 8. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-06 | Security Team | Initial policy creation |

---

**Document Owner:** Security Team  
**Review Cycle:** Quarterly  
**Next Review:** 2026-01-06

**Related Documents:**
- [Encryption Policy](./ENCRYPTION_POLICY.md)
- [Database TLS Verification](./DB_TLS_VERIFICATION.md)

---

*This policy implements comprehensive key management procedures in compliance with NIST SP 800-57, ISO 27001, and LGPD standards.*
