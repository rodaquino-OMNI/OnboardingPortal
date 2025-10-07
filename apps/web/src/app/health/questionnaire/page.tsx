/**
 * Health Questionnaire Page - Main entry point for health assessment
 *
 * ADR-003: Uses container pattern for separation of concerns
 * Feature flag protected route
 */

import { QuestionnaireContainer } from '@/containers/health/QuestionnaireContainer';
import { FeatureFlagGuard } from '@/components/FeatureFlagGuard';

export default function HealthQuestionnairePage() {
  return (
    <FeatureFlagGuard flag="sliceC_health">
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <QuestionnaireContainer questionnaireId={1} />
        </div>
      </div>
    </FeatureFlagGuard>
  );
}
