'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

function DevOnlyGuard({ children }: { children: React.ReactNode }) {
  const [isDev, setIsDev] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we're in development environment
    const isDevEnvironment = process.env.NODE_ENV === 'development' ||
                            process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
                            window.location.hostname === 'localhost' ||
                            window.location.hostname === '127.0.0.1' ||
                            window.location.hostname.includes('dev');

    setIsDev(isDevEnvironment);
  }, []);

  if (isDev === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isDev) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-6">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            The UI sandbox is only available in development environment.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Development Only</p>
                <p>This route is restricted to prevent exposure of internal components in production.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function SandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DevOnlyGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">UI Component Sandbox</h1>
              <p className="text-sm text-gray-600">Development environment for testing UI components</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Development Mode
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </DevOnlyGuard>
  );
}