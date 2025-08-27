'use client';

import { useAuth } from '@/hooks/useAuth';
import { eventBus, EventTypes } from '@/modules/events/EventBus';
import { gamificationIntegration } from '@/modules/gamification/GamificationIntegration';
import { useEffect, useState } from 'react';

/**
 * Test page to verify auth architecture activation
 */
export default function TestAuthPage() {
  const auth = useAuth();
  const [implementation, setImplementation] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [gamificationState, setGamificationState] = useState<any>(null);

  useEffect(() => {
    // Capture console logs
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`].slice(-20));
    };

    // Get implementation details
    if (typeof window !== 'undefined') {
      const impl = (window as any).__AUTH_IMPLEMENTATION__;
      setImplementation(impl);
    }

    // Listen for all auth events
    const authLoginUnsubscribe = eventBus.on(EventTypes.AUTH_LOGIN, (event) => {
      console.log('🚀 AUTH_LOGIN event received:', event);
      setEvents(prev => [...prev, {
        type: 'AUTH_LOGIN',
        payload: event.payload,
        timestamp: new Date().toLocaleTimeString(),
        source: event.source
      }].slice(-10));
    });

    const authLogoutUnsubscribe = eventBus.on(EventTypes.AUTH_LOGOUT, (event) => {
      console.log('🚨 AUTH_LOGOUT event received:', event);
      setEvents(prev => [...prev, {
        type: 'AUTH_LOGOUT',
        payload: event.payload,
        timestamp: new Date().toLocaleTimeString(),
        source: event.source
      }].slice(-10));
    });

    const authStateUnsubscribe = eventBus.on(EventTypes.AUTH_STATE_CHANGED, (event) => {
      console.log('🔄 AUTH_STATE_CHANGED event received:', event);
      setEvents(prev => [...prev, {
        type: 'AUTH_STATE_CHANGED',
        payload: event.payload,
        timestamp: new Date().toLocaleTimeString(),
        source: event.source
      }].slice(-10));
    });

    // Listen for gamification events
    const gamificationUnsubscribe = eventBus.on(/gamification\..*/, (event) => {
      console.log('🎮 Gamification event:', event.type, event.payload);
      setEvents(prev => [...prev, {
        type: event.type,
        payload: event.payload,
        timestamp: new Date().toLocaleTimeString(),
        source: event.source
      }].slice(-10));
    });

    // Update gamification state periodically
    const updateGamificationState = () => {
      try {
        const state = gamificationIntegration.getState();
        setGamificationState(state);
      } catch (error) {
        console.warn('Failed to get gamification state:', error);
      }
    };
    updateGamificationState();
    const gamificationInterval = setInterval(updateGamificationState, 2000);

    return () => {
      console.log = originalLog;
      authLoginUnsubscribe();
      authLogoutUnsubscribe();
      authStateUnsubscribe();
      gamificationUnsubscribe();
      clearInterval(gamificationInterval);
    };
  }, []);

  const handleTestLogin = async () => {
    try {
      // Use environment variables or prompt user for credentials
      const testEmail = process.env.NEXT_PUBLIC_TEST_EMAIL || prompt('Enter test email:');
      const testPassword = process.env.NEXT_PUBLIC_TEST_PASSWORD || prompt('Enter test password:');
      
      if (!testEmail || !testPassword) {
        console.error('Test credentials not provided');
        return;
      }
      
      await auth.login({
        login: testEmail,
        password: testPassword
      });
    } catch (error) {
      console.error('Login test failed:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔍 Auth Architecture Test</h1>
      
      {/* Implementation Status */}
      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">Implementation Status</h2>
        {implementation ? (
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="font-medium mr-2">Version:</span>
              <span className={`px-2 py-1 rounded text-white ${
                implementation.version === 'modular' ? 'bg-green-500' : 'bg-orange-500'
              }`}>
                {implementation.version}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              <div>USE_MODULAR_AUTH: {String(implementation.featureFlags?.USE_MODULAR_AUTH)}</div>
              <div>USE_UNIFIED_STATE: {String(implementation.featureFlags?.USE_UNIFIED_STATE)}</div>
              <div>USE_API_GATEWAY: {String(implementation.featureFlags?.USE_API_GATEWAY)}</div>
              <div>USE_EVENT_BUS: {String(implementation.featureFlags?.USE_EVENT_BUS)}</div>
            </div>
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>

      {/* Auth State */}
      <div className="bg-blue-50 p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">Current Auth State</h2>
        <div className="space-y-1 text-sm">
          <div>Authenticated: {String(auth.isAuthenticated)}</div>
          <div>Loading: {String(auth.isLoading)}</div>
          <div>User: {auth.user ? `${auth.user.email} (${auth.user.id})` : 'None'}</div>
          <div>Error: {auth.error || 'None'}</div>
        </div>
      </div>

      {/* Test Actions */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={handleTestLogin}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Login
        </button>
        <button
          onClick={() => auth.logout()}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Test Logout
        </button>
        <button
          onClick={() => auth.checkAuth()}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Check Auth
        </button>
      </div>

      {/* Event Bus Monitor */}
      <div className="bg-purple-50 p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">🚀 Event Bus Monitor</h2>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {events.length > 0 ? (
            events.map((event, i) => (
              <div key={i} className="bg-white p-2 rounded border-l-4 border-purple-400">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-sm font-semibold text-purple-600">
                    {event.type}
                  </span>
                  <span className="text-xs text-gray-500">{event.timestamp}</span>
                </div>
                {event.payload && (
                  <div className="text-xs text-gray-700 mt-1">
                    <strong>Payload:</strong> {JSON.stringify(event.payload, null, 2)}
                  </div>
                )}
                {event.source && (
                  <div className="text-xs text-gray-500">Source: {event.source}</div>
                )}
              </div>
            ))
          ) : (
            <div className="text-gray-500">No events captured yet...</div>
          )}
        </div>
      </div>

      {/* Gamification State */}
      <div className="bg-yellow-50 p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">🎮 Gamification State</h2>
        {gamificationState ? (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Points:</span>
                <span className="ml-2 px-2 py-1 bg-yellow-200 rounded">
                  {gamificationState.points}
                </span>
              </div>
              <div>
                <span className="font-medium">Level:</span>
                <span className="ml-2 px-2 py-1 bg-yellow-200 rounded">
                  {gamificationState.level}
                </span>
              </div>
            </div>
            <div>
              <span className="font-medium">Achievements:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {gamificationState.achievements.length > 0 ? (
                  gamificationState.achievements.map((achievement: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
                      {achievement}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-xs">No achievements yet</span>
                )}
              </div>
            </div>
            <div>
              <span className="font-medium">Progress:</span>
              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 max-h-32 overflow-auto">
                {JSON.stringify(gamificationState.progress, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Loading gamification state...</div>
        )}
      </div>

      {/* Console Logs */}
      <div className="bg-gray-900 text-green-400 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">📜 Console Logs</h2>
        <div className="text-xs font-mono space-y-1 max-h-64 overflow-y-auto">
          {logs.length > 0 ? (
            logs.map((log, i) => (
              <div key={i} className="border-b border-gray-700 pb-1">
                {log}
              </div>
            ))
          ) : (
            <div className="text-gray-500">No logs yet...</div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-yellow-50 rounded">
        <h3 className="font-semibold mb-2">🎯 What to Check:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Version should show &quot;modular&quot; if new architecture is active</li>
          <li>Console logs should show [AUTH ROUTER] messages</li>
          <li>Test login/logout should work without errors</li>
          <li>Check browser console for detailed logs</li>
          <li>Open DevTools and check: <code className="bg-gray-200 px-1">window.__AUTH_VERSION__</code></li>
        </ol>
      </div>
    </div>
  );
}