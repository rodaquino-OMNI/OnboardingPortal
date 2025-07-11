# Omni Onboarding Portal - Database Schema Documentation

## Overview
This document describes the complete database schema for the Omni Onboarding Portal healthcare system. The schema is designed to support a comprehensive beneficiary onboarding process with gamification, health assessments, document management, and LGPD compliance.

## Database Tables

### 1. **users**
Core authentication and user management table.
- **Purpose**: Store all system users (beneficiaries, admins, healthcare professionals)
- **Key Fields**:
  - `role`: Defines user type (beneficiary, company_admin, super_admin)
  - `preferred_language`: User's language preference
  - `preferences`: JSON field for user-specific settings
- **Relationships**: One-to-many with beneficiaries, documents, interviews, audit_logs

### 2. **companies**
Corporate accounts for B2B healthcare plans.
- **Purpose**: Manage companies that provide health benefits to employees
- **Key Fields**:
  - `cnpj`: Brazilian company registration number
  - `plan_type`: Service tier (basic, standard, premium, enterprise)
  - `max_beneficiaries`: Plan limit for beneficiaries
  - `settings`: Company-specific configuration
- **Relationships**: One-to-many with beneficiaries

### 3. **beneficiaries**
Detailed profiles for healthcare beneficiaries.
- **Purpose**: Store comprehensive beneficiary information
- **Key Fields**:
  - `cpf`: Brazilian individual taxpayer registry
  - `onboarding_status`: Track progress (pending, in_progress, completed, cancelled)
  - `onboarding_step`: Current step in the process
  - `custom_fields`: Flexible JSON storage for additional data
- **Relationships**: 
  - Belongs to user and optionally to company
  - Has many documents, health_questionnaires, interviews, gamification_progress

### 4. **gamification_progress**
Track user engagement and rewards.
- **Purpose**: Implement gamification to encourage onboarding completion
- **Key Fields**:
  - `total_points`: Accumulated points
  - `current_level`: User's achievement level
  - `badges_earned`: JSON array of earned badge IDs
  - `engagement_score`: Calculated engagement metric (0-100)
- **Relationships**: Belongs to beneficiary

### 5. **gamification_badges**
Define available badges and achievements.
- **Purpose**: Configure gamification rewards
- **Key Fields**:
  - `category`: Badge type (onboarding, health, engagement, milestone, special)
  - `rarity`: Badge value (common, uncommon, rare, epic, legendary)
  - `criteria`: JSON rules for earning the badge
  - `is_secret`: Hidden badges for surprise rewards
- **Relationships**: Many-to-many with beneficiaries through beneficiary_badges

### 6. **gamification_levels**
Define progression levels and rewards.
- **Purpose**: Create level-based progression system
- **Key Fields**:
  - `points_required`: Points needed to reach this level
  - `rewards`: JSON array of level rewards
  - `unlocked_features`: Features available at this level
  - `discount_percentage`: Service discounts for higher levels
- **Relationships**: Referenced by gamification_progress

### 7. **health_questionnaires**
Comprehensive health data collection.
- **Purpose**: Store detailed health assessments
- **Key Fields**:
  - `questionnaire_type`: Assessment type (initial, periodic, specific)
  - Health metrics: BMI, blood pressure, chronic conditions
  - Lifestyle data: Smoking, alcohol, exercise, sleep, stress
  - `custom_responses`: JSON for dynamic questionnaire fields
  - `accuracy_score`: Data quality metric
- **Relationships**: Belongs to beneficiary, can be reviewed by users

### 8. **documents**
Secure document storage with encryption.
- **Purpose**: Manage uploaded documents with LGPD compliance
- **Key Fields**:
  - `document_type`: Document classification
  - `status`: Verification status (pending, approved, rejected, expired)
  - `is_encrypted`: Security flag
  - `ocr_data`: Extracted text data
  - `version`: Document versioning support
- **Relationships**: Belongs to beneficiary and uploaded_by user

### 9. **document_types**
Define required and optional documents.
- **Purpose**: Configure document requirements
- **Key Fields**:
  - `code`: Unique identifier (rg, cpf, medical_report)
  - `accepted_formats`: Allowed file types
  - `validation_rules`: JSON validation criteria
  - `ocr_fields`: Fields to extract via OCR
- **Relationships**: Referenced by documents

### 10. **interview_slots**
Healthcare professional availability.
- **Purpose**: Manage appointment scheduling
- **Key Fields**:
  - `interview_type`: Consultation type (initial, follow_up, medical, psychological)
  - `meeting_type`: Format (in_person, video, phone)
  - `recurrence_pattern`: For recurring availability
  - `max_bookings`: Support group sessions
- **Relationships**: Belongs to healthcare professional, has many interviews

### 11. **interviews**
Scheduled appointments and consultations.
- **Purpose**: Track beneficiary consultations
- **Key Fields**:
  - `booking_reference`: Unique booking ID
  - `status`: Appointment status tracking
  - Session data: Notes, recommendations, follow-up actions
  - `beneficiary_rating`: Quality feedback
  - `recording_url`: For recorded sessions
- **Relationships**: Belongs to beneficiary, interview_slot, and healthcare professional

### 12. **audit_logs**
LGPD compliance and security tracking.
- **Purpose**: Comprehensive audit trail for compliance
- **Key Fields**:
  - `event_type`: Action classification
  - `model_type` & `model_id`: Polymorphic relationship
  - `old_values` & `new_values`: Data change tracking
  - Location data: IP, browser, geolocation
  - `legal_basis`: LGPD justification
  - `retention_days`: Auto-deletion schedule
- **Relationships**: Optionally belongs to user

### 13. **notifications**
Multi-channel notification system.
- **Purpose**: Manage user communications
- **Key Fields**:
  - `notifiable_type` & `notifiable_id`: Polymorphic recipient
  - `channel`: Delivery method (database, email, sms, push)
  - `priority`: Message urgency
  - `expires_at`: Auto-cleanup for outdated notifications
- **Relationships**: Polymorphic to any notifiable model

### 14. **health_categories**
Hierarchical health topic organization.
- **Purpose**: Organize health content and questionnaires
- **Key Fields**:
  - `parent_id`: Support for subcategories
  - `requires_specialist`: Flag for professional requirement
  - `related_conditions`: ICD-10 codes or conditions
  - `prevention_tips`: Health recommendations
- **Relationships**: Self-referential for hierarchy, has many questionnaire_templates

### 15. **questionnaire_templates**
Dynamic questionnaire configuration.
- **Purpose**: Create flexible health assessments
- **Key Fields**:
  - `sections`: JSON structure with questions
  - `scoring_rules`: Automated scoring logic
  - `risk_assessment_rules`: Health risk calculation
  - `languages`: Multi-language support
- **Relationships**: Belongs to health_category

### 16. **beneficiary_badges** (Pivot Table)
Track earned badges.
- **Purpose**: Many-to-many relationship between beneficiaries and badges
- **Key Fields**:
  - `earned_count`: For badges that can be earned multiple times
  - `earned_context`: JSON data about how badge was earned
  - `is_featured`: User's showcase selection

## Key Design Decisions

### 1. **Soft Deletes**
Most tables include soft deletes for data recovery and compliance.

### 2. **JSON Fields**
Strategic use of JSON fields for:
- Flexible configuration (preferences, settings)
- Dynamic content (questionnaire sections, badge criteria)
- Audit trails (old/new values)

### 3. **Extensive Indexing**
Optimized queries with indexes on:
- Foreign keys
- Status fields
- Date fields
- Frequently queried combinations

### 4. **LGPD Compliance**
- Comprehensive audit logging
- Data encryption flags
- Retention policies
- Consent tracking
- Data classification

### 5. **Polymorphic Relationships**
Used for:
- Notifications (any model can receive notifications)
- Audit logs (track changes on any model)

## Security Considerations

1. **Encrypted Storage**: Documents table includes encryption support
2. **Version Control**: Document versioning for compliance
3. **Access Logging**: All data access tracked in audit_logs
4. **Data Retention**: Automatic cleanup based on retention policies
5. **Sensitive Data Flags**: Clear marking of LGPD-sensitive information

## Performance Optimizations

1. **Composite Indexes**: Multi-column indexes for complex queries
2. **JSON Indexing**: Consider JSON column indexing for frequently accessed paths
3. **Partitioning**: Audit_logs table candidate for date-based partitioning
4. **Archival Strategy**: Old audit logs and notifications can be archived

## Migration Order

The migrations are numbered to ensure proper execution order:
1. users
2. companies  
3. beneficiaries
4. gamification_progress
5. health_questionnaires
6. documents
7. interview_slots
8. interviews
9. audit_logs
10. gamification_badges
11. gamification_levels
12. beneficiary_badges
13. notifications
14. document_types
15. health_categories
16. questionnaire_templates

## Seeding Strategy

The seeders provide:
- Admin and test users
- Sample companies with different plans
- Complete gamification setup (levels and badges)
- Document type configurations
- Health categories hierarchy
- Questionnaire templates for different assessments

This ensures a fully functional system immediately after deployment.