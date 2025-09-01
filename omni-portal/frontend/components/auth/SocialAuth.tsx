import React, { useState } from 'react';

interface SocialAuthProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
}

export default function SocialAuth({ onSuccess, onError }: SocialAuthProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [oauthUser, setOauthUser] = useState<any>(null);
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  const handleOAuthLogin = async (provider: 'google' | 'facebook' | 'instagram') => {
    setIsLoading(provider);

    try {
      // Get OAuth URL from backend
      const response = await fetch(`/api/auth/oauth/${provider}`);
      const { auth_url } = await response.json();

      // Open OAuth popup
      const popup = window.open(auth_url, 'oauth-popup', 'width=500,height=600');

      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth-callback') {
          if (event.data.error) {
            onError?.(event.data.error === 'access_denied' ? 'Authentication failed' : event.data.error);
            setIsLoading(null);
            return;
          }

          try {
            // Exchange code for user data
            const callbackResponse = await fetch('/api/auth/oauth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: event.data.code,
                provider: event.data.provider,
              }),
            });

            const data = await callbackResponse.json();

            if (callbackResponse.ok) {
              localStorage.setItem('access_token', data.access_token);
              
              if (data.is_new_user) {
                // New user needs to complete profile
                setOauthUser(data.user);
                setNeedsProfileCompletion(true);
              } else {
                // Existing user, login complete
                onSuccess?.(data.user);
              }
            } else {
              onError?.(data.error || 'Invalid authorization code');
            }
          } catch (err) {
            onError?.('Authentication failed');
          }
        }

        window.removeEventListener('message', handleMessage);
        setIsLoading(null);
      };

      window.addEventListener('message', handleMessage);

      // Cleanup if popup is closed
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleMessage);
          setIsLoading(null);
        }
      }, 1000);
    } catch (err) {
      onError?.('Failed to initialize authentication');
      setIsLoading(null);
    }
  };

  const handleProfileCompletion = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/auth/oauth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: oauthUser.id,
          cpf,
          phone,
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        onSuccess?.(updatedUser);
      } else {
        onError?.('Failed to complete profile');
      }
    } catch (err) {
      onError?.('Network error');
    }
  };

  if (needsProfileCompletion) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Complete Your Profile</h2>
        <p className="text-gray-600 mb-6">
          Welcome, {oauthUser.name}! Please complete your profile to continue.
        </p>

        <form onSubmit={handleProfileCompletion}>
          <div className="mb-4">
            <label htmlFor="cpf" className="block text-gray-700 mb-2">
              CPF
            </label>
            <input
              id="cpf"
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="000.000.000-00"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="phone" className="block text-gray-700 mb-2">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Complete Setup
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Profile completed successfully!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => handleOAuthLogin('google')}
        disabled={isLoading !== null}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded shadow-sm bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading === 'google' ? (
          <span>Connecting...</span>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>

      <button
        onClick={() => handleOAuthLogin('facebook')}
        disabled={isLoading !== null}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded shadow-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading === 'facebook' ? (
          <span>Connecting...</span>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" clipRule="evenodd" />
            </svg>
            Continue with Facebook
          </>
        )}
      </button>

      <button
        onClick={() => handleOAuthLogin('instagram')}
        disabled={isLoading !== null}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded shadow-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading === 'instagram' ? (
          <span>Connecting...</span>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm4.965-10.405a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.881-.001z"/>
            </svg>
            Continue with Instagram
          </>
        )}
      </button>

      <div className="mt-4 text-xs text-gray-500 text-center">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={() => onError?.('Try again')}
          className="text-blue-600 hover:underline text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}