'use client';

import { Suspense } from 'react';
import { CompletionContent } from '@/components/CompletionContent';

// Loading component for Suspense
function CompletionLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <div className="w-12 h-12 bg-blue-200 rounded-full"></div>
        </div>
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  );
}

export default function CompletionPage() {
  return (
    <Suspense fallback={<CompletionLoading />}>
      <CompletionContent />
    </Suspense>
  );
}