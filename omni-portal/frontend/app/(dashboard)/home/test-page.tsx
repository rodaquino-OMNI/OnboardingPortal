'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';

export default function TestPage() {
  const { user, isAuthenticated } = useAuth();
  const { stats, error, isLoadingStats, fetchStats } = useGamification();

  useEffect(() => {
    console.log('Auth Status:', { isAuthenticated, user });
    console.log('Stats:', stats);
    console.log('Error:', error);
    console.log('Loading:', isLoadingStats);
  }, [isAuthenticated, user, stats, error, isLoadingStats]);

  useEffect(() => {
    if (isAuthenticated && !stats && !isLoadingStats) {
      console.log('Fetching stats...');
      fetchStats().catch(err => {
        console.error('Failed to fetch stats:', err);
      });
    }
  }, [isAuthenticated, stats, isLoadingStats, fetchStats]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="font-semibold">Authentication Status</h2>
          <pre>{JSON.stringify({ isAuthenticated, user }, null, 2)}</pre>
        </div>
        
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="font-semibold">Gamification Stats</h2>
          <pre>{JSON.stringify({ stats, error, isLoadingStats }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}