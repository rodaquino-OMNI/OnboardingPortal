# Phase 8 P0-1 Encryption Remediation Checklist

**Status:** PRODUCTION BLOCKER
**Priority:** P0-1 (CRITICAL)
**Estimated Total Effort:** 6 hours immediate + 18 hours complete
**Due Date:** IMMEDIATE

---

## Immediate Actions (6 Hours - BLOCKING)

### Hour 1-2: Database Schema Migration

- [ ] **Create encryption migration file**
  - File: `database/migrations/2025_10_04_add_encryption_to_users_table.php`
  - Add `cpf_encrypted` VARBINARY(255) column
  - Add `cpf_hash` VARCHAR(64) UNIQUE column
  - Add `birthdate_encrypted` VARBINARY(255) column
  - Add `phone_encrypted` VARBINARY(255) column
  - Add `phone_hash` VARCHAR(64) column
  - Add indexes on hash columns
  - Test migration up/down

- [ ] **Backup production data**
  - Create full database backup before migration
  - Document backup location and timestamp
  - Test backup restoration on staging

- [ ] **Run migration on development**
  ```bash
  php artisan migrate
  php artisan db:show users  # Verify schema
  ```

### Hour 3-4: Model Encryption Implementation

- [ ] **Update User model**
  - File: `app/Models/User.php`
  - Import `Illuminate\Database\Eloquent\Casts\Attribute`
  - Import `Illuminate\Support\Facades\Crypt`
  - Implement `cpf()` Attribute accessor/mutator
  - Implement `birthdate()` Attribute accessor/mutator
  - Implement `phone()` Attribute accessor/mutator
  - Remove `cpf`, `birthdate`, `phone` from `$fillable` (use encrypted versions)
  - Add `cpf_encrypted`, `birthdate_encrypted`, `phone_encrypted` to `$fillable`
  - Update `$hidden` array to include encrypted fields

- [ ] **Example implementation:**
  ```php
  protected function cpf(): Attribute
  {
      return Attribute::make(
          get: fn ($value) => $this->cpf_encrypted
              ? Crypt::decryptString($this->cpf_encrypted)
              : null,
          set: function ($value) {
              if (!$value) return ['cpf_encrypted' => null, 'cpf_hash' => null];
              return [
                  'cpf_encrypted' => Crypt::encryptString($value),
                  'cpf_hash' => hash('sha256', $value),
              ];
          }
      );
  }
  ```

- [ ] **Test model encryption locally**
  ```bash
  php artisan tinker
  # Test: $user = User::factory()->create(['cpf' => '123.456.789-01']);
  # Verify: DB::table('users')->where('id', $user->id)->first();
  ```

### Hour 5: Data Migration Script

- [ ] **Create data migration script**
  - File: `database/scripts/encrypt_existing_users.php`
  - Chunk users in batches of 100
  - Encrypt existing plaintext CPF → cpf_encrypted
  - Generate cpf_hash for existing CPF
  - Encrypt existing plaintext birthdate → birthdate_encrypted
  - Encrypt existing plaintext phone → phone_encrypted
  - Generate phone_hash
  - Log migration progress
  - Handle errors gracefully

- [ ] **Test migration script on staging**
  ```bash
  php database/scripts/encrypt_existing_users.php --dry-run
  php database/scripts/encrypt_existing_users.php
  ```

- [ ] **Verify data integrity**
  - Count records before/after
  - Spot-check random users for correct decryption
  - Verify all cpf_hash values are unique

### Hour 6: Controller Updates & Testing

- [ ] **Update AuthController registration**
  - File: `app/Http/Controllers/Api/AuthController.php`
  - Update `register()` to use encrypted fields
  - Update validation rules if needed
  - Add audit logging for PHI access

- [ ] **Update all controllers accessing User model**
  - Search for direct `->cpf`, `->birthdate`, `->phone` access
  - Verify accessors are used (automatic via model)
  - Check for plaintext assignment

- [ ] **Run comprehensive tests**
  ```bash
  php artisan test --filter=User
  php artisan test --filter=Auth
  php artisan test --filter=Registration
  ```

- [ ] **Create manual test checklist**
  - [ ] Register new user with CPF/birthdate
  - [ ] Verify encrypted storage in database
  - [ ] Login with registered user
  - [ ] View profile with decrypted CPF
  - [ ] Search by CPF hash works
  - [ ] Duplicate CPF detection works

---

## Short-Term Actions (12 Hours - Within 2 Days)

### Hours 7-10: CI/CD Automation

- [ ] **Create GitHub Actions workflow**
  - File: `.github/workflows/security-plaintext-scan.yml`
  - Implement CPF plaintext detection
  - Implement birthdate plaintext detection
  - Implement model encryption verification
  - Implement hardcoded key detection
  - Configure PR blocking on violations

- [ ] **Create pre-commit hook**
  - File: `.git/hooks/pre-commit`
  - Local plaintext detection
  - Migration validation
  - Model encryption check
  - Installation script

- [ ] **Create PHPUnit test suite**
  - File: `tests/Feature/Security/EncryptionComplianceTest.php`
  - Test encrypted storage
  - Test hash generation
  - Test uniqueness validation
  - Test decryption accessors
  - Test no plaintext PHI in database

- [ ] **Run CI/CD locally**
  ```bash
  act -j plaintext-detection  # Test GitHub Action locally
  git commit -m "test"        # Test pre-commit hook
  ```

### Hours 11-12: Audit Logging Enhancement

- [ ] **Add PHI access logging**
  - File: `app/Services/AuditLogService.php`
  - Log CPF decryption events
  - Log birthdate access events
  - Track who accessed PHI and when
  - Add risk scoring for mass access

- [ ] **Update audit queries**
  - Add `phi_accessed` flag to audit logs
  - Implement PHI access reports
  - Create alerting for suspicious patterns

---

## Medium-Term Actions (18 Hours - Within 1 Week)

### Hours 13-18: KMS Integration

- [ ] **Configure AWS KMS**
  - Create KMS customer managed key (CMK)
  - Set up key rotation policy (annual)
  - Configure IAM roles for key access
  - Document key ARN and region

- [ ] **Implement KMS encryption driver**
  - Create custom Laravel encryption driver
  - Integrate with AWS KMS SDK
  - Update `.env` with KMS configuration
  - Test encryption/decryption with KMS

- [ ] **Update encryption service**
  - Create `EncryptionService` abstraction
  - Support both local and KMS encryption
  - Implement key rotation utilities
  - Add CloudWatch logging

### Hours 19-24: Monitoring & Documentation

- [ ] **Set up monitoring**
  - CloudWatch metrics for encryption operations
  - Dashboards for PHI access patterns
  - Alerts for compliance violations
  - Performance monitoring for encryption overhead

- [ ] **Create compliance documentation**
  - Encryption architecture diagram
  - Key management runbook
  - Disaster recovery procedures
  - Audit trail documentation

- [ ] **Performance testing**
  - Benchmark encryption overhead
  - Load testing with encrypted data
  - Query optimization for hash lookups
  - Caching strategy for frequently accessed data

### Hours 25-30: Testing & Validation

- [ ] **Integration testing**
  - End-to-end user registration flow
  - Profile update with encrypted fields
  - Admin search by CPF hash
  - Bulk operations performance

- [ ] **Security testing**
  - Penetration testing for plaintext exposure
  - SQL injection with encrypted data
  - Insider threat simulation
  - Backup restoration verification

- [ ] **Compliance validation**
  - HIPAA audit checklist
  - LGPD compliance review
  - Security audit preparation
  - Legal team review

---

## Verification Checklist

### Database Schema Verification

```sql
-- Run these queries to verify schema:

-- Check encrypted columns exist
SHOW COLUMNS FROM users LIKE '%encrypted';
SHOW COLUMNS FROM users LIKE '%hash';

-- Verify column types
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'users'
  AND COLUMN_NAME IN ('cpf_encrypted', 'cpf_hash', 'birthdate_encrypted');

-- Check indexes
SHOW INDEXES FROM users WHERE Column_name LIKE '%hash';

-- Verify no plaintext data
SELECT id, cpf, birthdate, phone FROM users LIMIT 10;
-- Should return NULL for legacy columns

-- Verify encrypted data exists
SELECT id,
       LENGTH(cpf_encrypted) as cpf_len,
       LENGTH(cpf_hash) as hash_len,
       cpf_hash
FROM users LIMIT 10;
```

### Application Testing

```bash
# 1. Unit tests
php artisan test tests/Feature/Security/EncryptionComplianceTest.php

# 2. Integration tests
php artisan test --filter=User

# 3. CI/CD validation
git commit -m "test: Verify encryption" --allow-empty
# Should pass pre-commit hook

# 4. Performance benchmarks
php artisan benchmark:encryption

# 5. Manual verification
php artisan tinker
>>> $user = User::find(1);
>>> $user->cpf;  // Should decrypt
>>> DB::table('users')->find(1)->cpf_encrypted;  // Should be encrypted binary
```

---

## Rollback Plan

### If Issues Detected

1. **Stop deployment immediately**
2. **Revert migration:**
   ```bash
   php artisan migrate:rollback --step=1
   ```
3. **Restore from backup:**
   ```bash
   mysql -u root -p onboarding < backup_2025_10_04.sql
   ```
4. **Document issue for post-mortem**
5. **Fix and re-test before retry**

### Rollback Checklist

- [ ] Database backup verified and accessible
- [ ] Rollback migration tested on staging
- [ ] Application code reverted to last stable commit
- [ ] All team members notified
- [ ] Post-mortem scheduled

---

## Communication Plan

### Stakeholder Updates

| Stakeholder | Update Frequency | Channel |
|-------------|------------------|---------|
| **Security Team** | Hourly during implementation | Slack #security |
| **Dev Team** | Before/after each phase | Slack #engineering |
| **Product Manager** | Daily summary | Email + Standup |
| **Compliance Officer** | Before/after completion | Email + Meeting |
| **CTO** | Pre-deployment + completion | In-person + Report |

### Status Report Template

```
# Encryption Remediation Status Report

**Date:** [YYYY-MM-DD]
**Phase:** [Immediate/Short-term/Medium-term]

## Completed ✅
- Task 1
- Task 2

## In Progress 🔄
- Task 3 (80% complete, ETA: 2h)

## Blocked ⚠️
- Task 4 (waiting for KMS setup)

## Issues Encountered 🔴
- None / [Description]

## Next Steps
1. Complete task 3
2. Begin task 5

**Risk Level:** [Low/Medium/High]
```

---

## Sign-Off

### Phase Completion Approvals

**Immediate Actions (6h) - REQUIRED FOR UNBLOCK:**
- [ ] Security Lead approval
- [ ] Database Admin review
- [ ] Dev Lead code review
- [ ] QA testing passed

**Short-Term Actions (12h):**
- [ ] CI/CD pipeline green
- [ ] Security test suite passing
- [ ] Code review approved

**Medium-Term Actions (18h):**
- [ ] KMS integration tested
- [ ] Performance benchmarks met
- [ ] Compliance officer approval
- [ ] Production deployment approved

---

## Success Criteria

### Must-Have (Blocking)
- ✅ CPF stored as VARBINARY with encryption
- ✅ Birthdate stored as VARBINARY with encryption
- ✅ Hash fields for uniqueness validation
- ✅ No plaintext PHI in database
- ✅ Encryption accessors working
- ✅ All tests passing

### Should-Have (High Priority)
- ✅ CI/CD automation in place
- ✅ Pre-commit hooks installed
- ✅ Audit logging enhanced
- ✅ Performance acceptable (<20ms overhead)

### Nice-to-Have (Medium Priority)
- ✅ KMS integration complete
- ✅ Monitoring dashboards live
- ✅ Compliance documentation ready

---

**Document Version:** 1.0
**Last Updated:** 2025-10-04
**Owner:** Security Lead
**Status:** IN PROGRESS
