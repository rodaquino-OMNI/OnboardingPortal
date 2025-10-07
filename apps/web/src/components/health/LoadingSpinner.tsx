/**
 * Loading Spinner - Reusable loading state component
 *
 * Pure UI component with no business logic
 */

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading questionnaire...</p>
      </div>
    </div>
  );
}
