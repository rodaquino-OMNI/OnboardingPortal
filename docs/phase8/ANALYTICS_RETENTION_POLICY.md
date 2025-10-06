# Analytics Retention Policy

**Status:** Implemented
**Version:** 1.0.0
**Last Updated:** 2025-10-06

## Overview

This document defines the retention policy for analytics events stored in the `analytics_events` table.

## Retention Period

**Default Retention:** 90 days

Analytics events are automatically pruned after 90 days to comply with LGPD and HIPAA data retention requirements.

## Compliance Checklist

- [x] 90-day retention period implemented
- [x] Automated daily pruning scheduled
- [x] PII detection before persistence
- [x] User ID hashing (SHA256)
- [x] Environment-aware error handling
- [x] Schema validation for all event types
- [x] Migration drift detection (CI)
- [x] Comprehensive test coverage
- [x] Documentation complete

## References

- **Repository:** `app/Services/AnalyticsEventRepository.php`
- **Model:** `app/Models/AnalyticsEvent.php`
- **Command:** `app/Console/Commands/PruneAnalyticsEvents.php`
