'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Shield, RefreshCw } from 'lucide-react';

interface TwoFactorAuthProps {
  onSubmit: (code: string) => Promise<void>;
  onResendCode?: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  mode?: 'verify' | 'setup';
  qrCode?: string;
  secret?: string;
}

export const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({
  onSubmit,
  onResendCode,
  isLoading = false,
  error = null,
  mode = 'verify',
  qrCode,
  secret
}) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (timeLeft > 0 && !canResend) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setCanResend(true);
    }
  }, [timeLeft, canResend]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Take only the last character
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (submitCode?: string) => {
    const codeToSubmit = submitCode || code.join('');
    
    if (codeToSubmit.length !== 6) {
      return;
    }

    try {
      await onSubmit(codeToSubmit);
    } catch (err) {
      // Error handled by parent
      // Clear the code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (onResendCode && canResend) {
      try {
        await onResendCode();
        setTimeLeft(30);
        setCanResend(false);
      } catch (err) {
        // Error handled by parent
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  if (mode === 'setup') {
    return (
      <Card className="w-full max-w-md mx-auto p-6">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Configurar 2FA</h1>
            <p className="text-gray-600">Configure a autenticação de dois fatores para maior segurança</p>
          </div>

          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">1. Escaneie o código QR</h3>
              <p className="text-sm text-gray-600 mb-4">
                Use seu aplicativo de autenticação (Google Authenticator, Authy, etc.) para escanear o código abaixo:
              </p>
              {qrCode && (
                <div className="flex justify-center p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <img src={qrCode} alt="QR Code for 2FA setup" className="w-48 h-48" />
                </div>
              )}
            </div>

            {secret && (
              <div>
                <h3 className="font-medium mb-2">2. Ou digite o código manualmente</h3>
                <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm break-all">
                  {secret}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-medium mb-2">3. Digite o código do aplicativo</h3>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="flex justify-center space-x-2">
                  {code.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-12 text-center text-lg font-mono"
                      disabled={isLoading}
                    />
                  ))}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || code.some(digit => !digit)}
                >
                  {isLoading ? 'Verificando...' : 'Ativar 2FA'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verificação 2FA</h1>
          <p className="text-gray-600">Digite o código de 6 dígitos do seu aplicativo de autenticação</p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="2fa-code" className="sr-only">Código 2FA</Label>
            <div className="flex justify-center space-x-2">
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-lg font-mono"
                  disabled={isLoading}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || code.some(digit => !digit)}
          >
            {isLoading ? 'Verificando...' : 'Verificar Código'}
          </Button>
        </form>

        {/* Resend option */}
        {onResendCode && (
          <div className="text-center">
            {canResend ? (
              <Button 
                type="button" 
                variant="ghost" 
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reenviar código
              </Button>
            ) : (
              <p className="text-sm text-gray-500">
                Reenviar código em {timeLeft}s
              </p>
            )}
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Não recebeu o código? Verifique se o horário do seu dispositivo está correto.
          </p>
        </div>
      </div>
    </Card>
  );
};