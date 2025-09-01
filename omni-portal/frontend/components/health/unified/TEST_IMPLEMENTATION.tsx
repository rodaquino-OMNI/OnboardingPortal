'use client';

import React from 'react';
import { UnifiedHealthQuestionnaire } from '../UnifiedHealthQuestionnaire';

// Test implementation showing different configurations
export function TestImplementation() {
  const handleComplete = (data: any) => {
    console.log('Questionnaire completed:', data);
  };

  return (
    <div className="space-y-8 p-8">
      <h1 className="text-2xl font-bold">Unified Health Questionnaire Test</h1>
      
      {/* Standard Mode */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Standard Mode</h2>
        <UnifiedHealthQuestionnaire
          onComplete={handleComplete}
          userId="test-user-1"
          mode="standard"
        />
      </section>

      {/* Conversational Mode */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Conversational Mode</h2>
        <UnifiedHealthQuestionnaire
          onComplete={handleComplete}
          userId="test-user-2"
          mode="conversational"
        />
      </section>

      {/* Clinical Mode */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Clinical Mode</h2>
        <UnifiedHealthQuestionnaire
          onComplete={handleComplete}
          userId="test-user-3"
          mode="clinical"
        />
      </section>

      {/* Custom Configuration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Custom Configuration</h2>
        <UnifiedHealthQuestionnaire
          onComplete={handleComplete}
          userId="test-user-4"
          mode="standard"
          features={{
            ai: false,
            gamification: true,
            clinical: true,
            progressive: false,
            accessibility: true
          }}
          theme="high-contrast"
        />
      </section>
    </div>
  );
}