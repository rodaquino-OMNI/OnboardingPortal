/**
 * Questionnaire Container - Orchestration layer for health questionnaire
 *
 * ADR-003: Container handles:
 * - Data fetching (SWR)
 * - Business logic
 * - Analytics tracking
 * - State management
 *
 * UI components remain pure and reusable
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuestionnaireOrchestration } from '@/hooks/useQuestionnaireOrchestration';
import {
  DynamicFormRenderer,
  QuestionnaireProgress,
  ErrorSummary,
  SectionHeader,
} from '@austa/ui/forms';
import { LoadingSpinner } from '@/components/health/LoadingSpinner';
import { ErrorState } from '@/components/health/ErrorState';

interface QuestionnaireContainerProps {
  questionnaireId: number;
}

export function QuestionnaireContainer({ questionnaireId }: QuestionnaireContainerProps) {
  const router = useRouter();

  const {
    schema,
    isLoadingSchema,
    schemaError,
    saveDraft,
    submit,
    isSubmitting,
    submitError,
    currentStep,
    totalSteps,
    nextStep,
    previousStep,
    visibleQuestions,
    trackPageTurn,
    questionnaireSchema,
  } = useQuestionnaireOrchestration(questionnaireId);

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(questionnaireSchema),
    mode: 'onChange',
  });

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const subscription = watch((formData) => {
      const timer = setTimeout(() => {
        saveDraft(formData);
      }, 30000); // 30 seconds

      return () => clearTimeout(timer);
    });

    return () => subscription.unsubscribe();
  }, [watch, saveDraft]);

  // Track page dwell time for analytics
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const dwellMs = performance.now() - startTime;
      trackPageTurn(currentStep, dwellMs);
    };
  }, [currentStep, trackPageTurn]);

  // Handle form submission
  const onSubmit = async (data: Record<string, any>) => {
    try {
      await submit(data);
      // Navigate to completion page
      router.push('/health/questionnaire/complete');
    } catch (error) {
      console.error('Submission failed:', error);
      // Error is handled by submitError state
    }
  };

  // Loading state
  if (isLoadingSchema) {
    return <LoadingSpinner />;
  }

  // Error state
  if (schemaError) {
    return <ErrorState error={schemaError} />;
  }

  // Get current section
  const currentSection = visibleQuestions[currentStep];

  if (!currentSection) {
    return <ErrorState error={new Error('Invalid questionnaire step')} />;
  }

  return (
    <div className="bg-white shadow-sm rounded-lg p-8">
      {/* Progress Indicator */}
      <QuestionnaireProgress
        currentStep={currentStep}
        totalSteps={totalSteps}
        completionPercentage={((currentStep + 1) / totalSteps) * 100}
        stepLabels={visibleQuestions.map(s => s.title)}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
        {/* Error Summary */}
        {Object.keys(errors).length > 0 && (
          <ErrorSummary errors={errors} />
        )}

        {/* Submission Error */}
        {submitError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              Failed to submit questionnaire. Please try again.
            </p>
          </div>
        )}

        {/* Section Header */}
        <SectionHeader
          title={currentSection.title}
          description={currentSection.description}
        />

        {/* Dynamic Form Renderer */}
        <DynamicFormRenderer
          questions={currentSection.questions}
          values={watch()}
          errors={errors}
          onChange={(fieldId, value) => setValue(fieldId, value)}
        />

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={previousStep}
            disabled={currentStep === 0}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Questionnaire'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
