'use client';

// Gamification imports removed - header showing incorrect points was disconnected
import ErrorBoundary from '@/components/ErrorBoundary';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        {/* Header removed - disconnected gamification showing incorrect points (0 vs actual 265) */}
        
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}