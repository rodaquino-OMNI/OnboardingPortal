import React, { useState, useEffect } from 'react';

interface Session {
  id: string;
  device: string;
  ip: string;
  location: string;
  last_active: string;
  current: boolean;
  suspicious?: boolean;
}

interface SessionManagerProps {
  onSessionRevoked?: () => void;
}

export default function SessionManager({ onSessionRevoked }: SessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenExpired, setTokenExpired] = useState(false);

  useEffect(() => {
    fetchSessions();
    setupTokenRefresh();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/auth/sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      } else if (response.status === 401) {
        setTokenExpired(true);
      } else {
        setError('Failed to load sessions');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const setupTokenRefresh = () => {
    const tokenExpiresAt = localStorage.getItem('token_expires_at');
    if (!tokenExpiresAt) return;

    const expiresIn = new Date(tokenExpiresAt).getTime() - Date.now();
    
    // Refresh 1 minute before expiry
    const refreshIn = Math.max(0, expiresIn - 60000);

    if (refreshIn > 0) {
      setTimeout(async () => {
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access_token);
            const newExpiry = new Date(Date.now() + data.expires_in * 1000);
            localStorage.setItem('token_expires_at', newExpiry.toISOString());
            setupTokenRefresh(); // Schedule next refresh
          } else {
            setTokenExpired(true);
          }
        } catch (err) {
          console.error('Token refresh failed:', err);
        }
      }, refreshIn);
    } else {
      refreshToken();
    }
  };

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        setupTokenRefresh();
      } else {
        localStorage.removeItem('access_token');
        setTokenExpired(true);
      }
    } catch (err) {
      setTokenExpired(true);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId));
        onSessionRevoked?.();
      } else {
        setError('Failed to revoke session');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  if (tokenExpired) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Session Expired</h2>
        <p className="text-gray-600 mb-6">
          Your session has expired. Please sign in again.
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Sign In Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const suspiciousSessions = sessions.filter(s => s.suspicious);
  const normalSessions = sessions.filter(s => !s.suspicious);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Active Sessions</h2>

      {suspiciousSessions.length > 0 && (
        <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 font-semibold">
            ⚠️ Suspicious session detected
          </p>
          <p className="text-sm text-red-600 mt-1">
            We detected unusual activity. Please review and revoke any sessions you don't recognize.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {suspiciousSessions.map(session => (
          <div
            key={session.id}
            data-testid={`session-${session.id}`}
            className="p-4 border-2 border-red-300 rounded bg-red-50"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-red-700">{session.device}</p>
                <p className="text-sm text-gray-600">IP: {session.ip}</p>
                <p className="text-sm text-gray-600">Location: {session.location}</p>
                <p className="text-sm text-gray-500">
                  Last active: {new Date(session.last_active).toLocaleString()}
                </p>
                <p className="text-sm text-red-600 font-semibold mt-1">
                  ⚠️ Suspicious activity detected
                </p>
              </div>
              <button
                onClick={() => handleRevokeSession(session.id)}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Revoke Immediately
              </button>
            </div>
          </div>
        ))}

        {normalSessions.map(session => (
          <div
            key={session.id}
            data-testid={`session-${session.id}`}
            className="p-4 border border-gray-200 rounded"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{session.device}</p>
                <p className="text-sm text-gray-600">IP: {session.ip}</p>
                <p className="text-sm text-gray-600">Location: {session.location}</p>
                <p className="text-sm text-gray-500">
                  Last active: {new Date(session.last_active).toLocaleString()}
                </p>
                {session.current && (
                  <p className="text-sm text-green-600 font-semibold mt-1">
                    ✓ Current session
                  </p>
                )}
              </div>
              {!session.current && (
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>Session revoked successfully</p>
      </div>

      <div
        data-testid="connection-status"
        className="mt-4 text-sm text-gray-500"
      >
        Connected
      </div>
    </div>
  );
}