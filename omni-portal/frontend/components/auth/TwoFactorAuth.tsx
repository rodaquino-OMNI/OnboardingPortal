import React, { useState, useRef, useEffect } from 'react';

interface TwoFactorAuthProps {
  sessionToken: string;
  onSuccess?: (user: any) => void;
  onCancel?: () => void;
}

export default function TwoFactorAuth({ sessionToken, onSuccess, onCancel }: TwoFactorAuthProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fullCode, session_token: sessionToken }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.access_token);
        onSuccess?.(data.user);
      } else {
        setAttempts(attempts + 1);
        setError(data.error || 'Invalid code');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();

        if (attempts >= 2) {
          setError('Too many failed attempts. Please request a new code.');
        }
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setCanResend(false);
    setResendCountdown(60);
    setError('');
    
    try {
      await fetch('/api/auth/2fa/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken }),
      });
      
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      // Show success message
      setError('Code sent successfully');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setError('Failed to resend code');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Two-Factor Authentication</h2>
      <p className="text-gray-600 mb-6">
        Enter the 6-digit verification code sent to your registered device.
      </p>

      <div className="flex justify-center space-x-2 mb-6">
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            role="textbox"
            aria-label={`Digit ${index + 1}`}
            value={digit}
            onChange={(e) => handleCodeChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-12 h-12 text-center text-xl border-2 border-gray-300 rounded focus:border-blue-500 focus:outline-none"
            maxLength={1}
            pattern="[0-9]"
            inputMode="numeric"
          />
        ))}
      </div>

      {error && (
        <div className={`mb-4 text-sm ${error.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>
          {error}
        </div>
      )}

      {attempts < 3 && (
        <div className="text-sm text-gray-600 mb-4">
          {3 - attempts} attempts remaining
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={isVerifying || attempts >= 3}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isVerifying ? 'Verifying...' : 'Verify'}
      </button>

      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={handleResend}
          disabled={!canResend || attempts >= 3}
          className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          {canResend ? 'Resend Code' : `Resend in ${resendCountdown}s`}
        </button>

        {attempts >= 3 && (
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:underline"
          >
            Request New Code
          </button>
        )}
        
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-600 hover:underline"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}