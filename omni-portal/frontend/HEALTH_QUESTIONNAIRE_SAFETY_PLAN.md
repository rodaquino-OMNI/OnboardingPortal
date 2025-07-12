# Health Questionnaire System - Comprehensive Safety Plan

## Executive Summary
This safety plan outlines all risks, dependencies, and mitigation strategies for implementing the new comprehensive health questionnaire system while ensuring zero disruption to the existing production system.

## Current System Analysis

### Existing Components
1. **Frontend**: `/app/(onboarding)/health-questionnaire/page.tsx`
   - Basic questionnaire implementation
   - Simple section-based navigation
   - Basic validation and AI chat integration
   - Gamification points system

2. **Backend**: `HealthQuestionnaireController.php`
   - Template-based questionnaire system
   - Response storage and validation
   - AI insights integration
   - Basic scoring and risk assessment

3. **Database Tables**:
   - `health_questionnaires`: Stores questionnaire responses
   - `questionnaire_templates`: Stores questionnaire structure
   - `health_categories`: Category organization

## Risk Assessment & Mitigation Strategies

### 1. Database Schema Changes

#### Required Changes:
- Add new columns to `health_questionnaires` table:
  - `fraud_score` (integer)
  - `trust_indicators` (JSON)
  - `validation_failures` (JSON)
  - `ai_recommendations` (JSON)
  - `health_score` (integer)
  - `badges_earned` (JSON)

- Create new tables:
  - `health_questionnaire_versions` (for version control)
  - `health_risk_assessments` (detailed risk tracking)
  - `health_validation_logs` (fraud detection audit trail)

#### Mitigation Strategy:
```sql
-- Safe migration approach with rollback capability
BEGIN TRANSACTION;

-- Create backup table
CREATE TABLE health_questionnaires_backup AS 
SELECT * FROM health_questionnaires;

-- Add new columns with defaults
ALTER TABLE health_questionnaires 
ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trust_indicators JSON DEFAULT '{}',
ADD COLUMN IF NOT EXISTS validation_failures JSON DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_recommendations JSON DEFAULT '[]',
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS badges_earned JSON DEFAULT '[]';

-- Create version control table
CREATE TABLE IF NOT EXISTS health_questionnaire_versions (
    id SERIAL PRIMARY KEY,
    questionnaire_id INTEGER REFERENCES health_questionnaires(id),
    version INTEGER NOT NULL,
    responses JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rollback command if needed
-- ROLLBACK;
COMMIT;
```

### 2. API Endpoint Modifications

#### New Endpoints Required:
- `POST /api/health-questionnaires/validate-consistency`
- `GET /api/health-questionnaires/{id}/fraud-check`
- `POST /api/health-questionnaires/{id}/calculate-health-score`
- `GET /api/health-questionnaires/clinical-tools/{tool}`

#### Backward Compatibility Strategy:
1. **Versioned API Approach**:
   ```php
   Route::prefix('api/v2/health-questionnaires')->group(function () {
       // New endpoints here
   });
   ```

2. **Feature Flags**:
   ```php
   if (config('features.advanced_health_questionnaire')) {
       // New logic
   } else {
       // Existing logic
   }
   ```

3. **Response Format Compatibility**:
   ```php
   public function getTemplates(Request $request) {
       $version = $request->header('API-Version', 'v1');
       
       if ($version === 'v2') {
           return $this->getTemplatesV2();
       }
       
       return $this->getTemplatesV1(); // Existing format
   }
   ```

### 3. Frontend Component Dependencies

#### Migration Strategy:
1. **Parallel Implementation**:
   - Keep existing `HealthQuestionnairePage` component
   - Implement new `SmartHealthQuestionnaire` alongside
   - Use feature flag to switch between them

2. **Gradual Rollout**:
   ```tsx
   // In page.tsx
   const useNewQuestionnaire = await checkFeatureFlag('smart_health_questionnaire', userId);
   
   if (useNewQuestionnaire) {
       return <SmartHealthQuestionnaire onComplete={handleComplete} userId={userId} />;
   }
   
   return <HealthQuestionnairePage />; // Existing component
   ```

3. **State Management Migration**:
   - Implement adapter pattern to convert between old and new data formats
   - Ensure both components can read/write to same backend

### 4. Data Migration Requirements

#### Migration Plan:
1. **Phase 1: Data Analysis**
   ```sql
   -- Analyze existing data patterns
   SELECT 
       COUNT(*) as total_questionnaires,
       COUNT(DISTINCT beneficiary_id) as unique_users,
       AVG(completion_percentage) as avg_completion,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
   FROM health_questionnaires;
   ```

2. **Phase 2: Backfill New Fields**
   ```php
   // Migration job to calculate scores for existing questionnaires
   class BackfillHealthScoresJob extends Job {
       public function handle() {
           HealthQuestionnaire::whereNull('health_score')
               ->chunk(100, function ($questionnaires) {
                   foreach ($questionnaires as $q) {
                       $score = $this->calculateHealthScore($q->responses);
                       $q->update(['health_score' => $score]);
                   }
               });
       }
   }
   ```

3. **Phase 3: Template Migration**
   - Convert existing templates to new format
   - Add clinical tool metadata
   - Add validation pairs

### 5. Backward Compatibility Concerns

#### Compatibility Checklist:
- [ ] Existing API responses maintain same structure
- [ ] Database changes are additive only
- [ ] Frontend can handle both old and new data formats
- [ ] Mobile apps continue to work without updates
- [ ] Third-party integrations unaffected

#### Compatibility Layer:
```php
class QuestionnaireCompatibilityService {
    public function transformToV1Format($v2Data) {
        // Transform new format to old for backward compatibility
        return [
            'id' => $v2Data['id'],
            'responses' => $v2Data['responses'],
            'status' => $v2Data['status'],
            // Omit new fields for v1 clients
        ];
    }
    
    public function transformToV2Format($v1Data) {
        // Enhance old data with defaults for new fields
        return array_merge($v1Data, [
            'fraud_score' => 0,
            'health_score' => $this->calculateBasicScore($v1Data),
            'trust_indicators' => [],
        ]);
    }
}
```

### 6. Testing Requirements

#### Test Coverage Plan:
1. **Unit Tests**:
   - Risk scoring algorithm
   - Fraud detection logic
   - Data transformation functions
   - Validation rules

2. **Integration Tests**:
   - API endpoint compatibility
   - Database migration rollback
   - Feature flag switching
   - Cross-version data flow

3. **E2E Tests**:
   - Complete questionnaire flow (both versions)
   - Data consistency checks
   - Performance benchmarks
   - Mobile responsiveness

4. **Load Tests**:
   - Concurrent questionnaire submissions
   - AI service integration under load
   - Database performance with new indexes

### 7. Rollback Procedures

#### Rollback Plan:
1. **Database Rollback**:
   ```sql
   -- Quick rollback script
   BEGIN TRANSACTION;
   
   -- Restore original table
   DROP TABLE health_questionnaires;
   ALTER TABLE health_questionnaires_backup 
   RENAME TO health_questionnaires;
   
   -- Drop new tables
   DROP TABLE IF EXISTS health_questionnaire_versions;
   DROP TABLE IF EXISTS health_risk_assessments;
   
   COMMIT;
   ```

2. **Code Rollback**:
   - Git tags for each deployment phase
   - Feature flags to disable new code paths
   - CDN cache purge procedures

3. **Data Rollback**:
   - Automated backup before migration
   - Point-in-time recovery capability
   - Data validation scripts

## Implementation Timeline

### Phase 1: Preparation (Week 1)
- [ ] Create comprehensive test suite
- [ ] Set up feature flags
- [ ] Implement monitoring dashboards
- [ ] Create rollback scripts

### Phase 2: Backend Implementation (Week 2-3)
- [ ] Deploy database migrations to staging
- [ ] Implement new API endpoints
- [ ] Add compatibility layer
- [ ] Performance testing

### Phase 3: Frontend Implementation (Week 4-5)
- [ ] Deploy SmartHealthQuestionnaire component
- [ ] Implement feature flag switching
- [ ] A/B testing setup
- [ ] User acceptance testing

### Phase 4: Gradual Rollout (Week 6-8)
- [ ] 5% of users on new system
- [ ] Monitor metrics and errors
- [ ] 25% rollout if stable
- [ ] 50% rollout with monitoring
- [ ] 100% after validation

## Monitoring & Alerts

### Key Metrics to Monitor:
1. **Performance Metrics**:
   - API response times
   - Database query performance
   - Frontend load times
   - AI service latency

2. **Business Metrics**:
   - Questionnaire completion rates
   - User drop-off points
   - Data quality scores
   - Fraud detection rates

3. **Error Metrics**:
   - API error rates
   - Validation failures
   - Frontend exceptions
   - Database deadlocks

### Alert Thresholds:
```yaml
alerts:
  - name: "High API Error Rate"
    condition: "error_rate > 5%"
    action: "Rollback to previous version"
    
  - name: "Low Completion Rate"
    condition: "completion_rate < 70% of baseline"
    action: "Investigate and potentially rollback"
    
  - name: "Database Performance Degradation"
    condition: "query_time > 2x baseline"
    action: "Scale database or optimize queries"
```

## Security Considerations

### Data Protection:
1. Encrypt sensitive health data at rest
2. Implement field-level encryption for mental health responses
3. Audit trail for all data access
4. LGPD compliance validation

### Access Control:
1. Role-based access for healthcare providers
2. Patient consent management
3. Data retention policies
4. Right to deletion implementation

## Success Criteria

### Technical Success:
- Zero downtime during migration
- No data loss or corruption
- API backward compatibility maintained
- Performance within 10% of baseline

### Business Success:
- Questionnaire completion rate ≥ current rate
- User satisfaction scores maintained
- Fraud detection catching 90%+ of test cases
- Clinical tool compliance validated

## Emergency Contacts

- **Technical Lead**: [Contact Info]
- **Database Admin**: [Contact Info]
- **DevOps Lead**: [Contact Info]
- **Product Manager**: [Contact Info]
- **On-call Engineer**: [Rotation Schedule]

## Appendices

### A. Database Migration Scripts
[Detailed scripts provided separately]

### B. API Documentation Updates
[OpenAPI spec changes documented]

### C. Test Case Catalog
[Comprehensive test scenarios listed]

### D. Monitoring Dashboard Links
[Grafana/DataDog dashboard URLs]

---

**Document Version**: 1.0
**Last Updated**: [Current Date]
**Approved By**: [Stakeholder Names]