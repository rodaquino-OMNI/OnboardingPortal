/**
 * Sprint 2C - Registration Completion Page
 *
 * ADR-003 Compliant: Page orchestrates, component renders
 * Analytics: Tracks registration_completed + points_earned
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompletionMessage } from '@onboarding/ui';

export default function CompletionPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<{
    name: string;
    pointsEarned: number;
    userId: string;
  } | null>(null);

  useEffect(() => {
    // Fetch user completion data
    fetchCompletionData();
  }, []);

  const fetchCompletionData = async () => {
    try {
      const response = await fetch('/api/registration/completion', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        router.push('/register');
        return;
      }

      const data = await response.json();
      setUserData(data);

      // Track analytics: registration_completed
      trackAnalyticsEvent({
        event_type: 'registration_completed',
        user_id: `hash_${data.userId}`,
        timestamp: new Date().toISOString(),
        total_steps_completed: 3,
        time_to_complete_seconds: data.completionTimeSeconds,
      });

      // Track analytics: points_earned
      trackAnalyticsEvent({
        event_type: 'points_earned',
        user_id: `hash_${data.userId}`,
        timestamp: new Date().toISOString(),
        points_amount: data.pointsEarned,
        points_source: 'registration_completion',
        total_points_balance: data.pointsEarned,
      });
    } catch (error) {
      console.error('Failed to fetch completion data:', error);
    }
  };

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <CompletionMessage
        userName={userData.name}
        pointsEarned={userData.pointsEarned}
        dashboardUrl="/dashboard"
      />
    </div>
  );
}

function trackAnalyticsEvent(event: Record<string, unknown>): void {
  console.log('[Analytics]', event);
}
