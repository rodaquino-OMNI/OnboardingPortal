import React, { useState } from 'react';

interface PasswordResetProps {
  token?: string;
  onSuccess?: () => void;
}

export default function PasswordReset({ token, onSuccess }: PasswordResetProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  const checkPasswordStrength = (pwd: string) => {
    setPasswordStrength({
      hasMinLength: pwd.length >= 8,
      hasUpperCase: /[A-Z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecialChar: /[!@#$%^&*]/.test(pwd),
    });
  };

  const isPasswordStrong = () => {
    return Object.values(passwordStrength).every(v => v);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/password/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.message || 'Failed to send reset email');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordStrong()) {
      setError('Password does not meet all requirements');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/password/reset-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        onSuccess?.();
      } else {
        if (data.error === 'Token expired') {
          setError('Token expired. Please request a new reset link.');
        } else {
          setError(data.error || 'Failed to reset password');
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success && !token) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="text-green-600 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Reset Email Sent</h2>
        <p className="text-gray-600 mb-4">
          Check your email for a password reset link. It expires in 60 minutes.
        </p>
      </div>
    );
  }

  if (success && token) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="text-green-600 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Password Updated</h2>
        <p className="text-gray-600 mb-4">
          Your password has been successfully updated.
        </p>
        <a href="/login" className="text-blue-600 hover:underline">
          Sign In
        </a>
      </div>
    );
  }

  if (token) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Create New Password</h2>
        
        <form onSubmit={handlePasswordReset}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-700 mb-2">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                checkPasswordStrength(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="confirmPassword" className="block text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-4 text-sm">
            <p className="font-semibold mb-2">Password Requirements:</p>
            <ul className="space-y-1">
              <li className={passwordStrength.hasMinLength ? 'text-green-600' : 'text-gray-500'}>
                ✓ At least 8 characters
              </li>
              <li className={passwordStrength.hasUpperCase ? 'text-green-600' : 'text-gray-500'}>
                ✓ One uppercase letter
              </li>
              <li className={passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                ✓ One number
              </li>
              <li className={passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}>
                ✓ One special character
              </li>
            </ul>
            {isPasswordStrong() && (
              <p className="text-green-600 mt-2">Strong password</p>
            )}
          </div>

          {error && (
            <div className="mb-4 text-red-600 text-sm">
              {error}
              {error.includes('expired') && (
                <button
                  type="button"
                  onClick={() => window.location.href = '/password-reset'}
                  className="block mt-2 text-blue-600 hover:underline"
                >
                  Request New Link
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !isPasswordStrong()}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Reset Password</h2>
      <p className="text-gray-600 mb-6">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>
      
      <form onSubmit={handleEmailSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {error && (
          <div className="mb-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
}