/**
 * Questionnaire Completion Page - Success confirmation after submission
 *
 * Displays success message and next steps
 */

'use client';

import { useRouter } from 'next/navigation';

export default function QuestionnaireCompletePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <svg
          className="mx-auto h-16 w-16 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Questionnaire Submitted
        </h1>

        <p className="mt-2 text-gray-600">
          Thank you for completing your health assessment.
          Your responses have been securely submitted and encrypted.
        </p>

        <p className="mt-4 text-sm text-gray-500">
          A healthcare professional will review your information and reach out if needed.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
