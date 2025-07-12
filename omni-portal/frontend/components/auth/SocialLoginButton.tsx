import React from 'react';
import { FaGoogle, FaFacebook, FaInstagram } from 'react-icons/fa';

interface SocialLoginButtonProps {
  provider: 'google' | 'facebook' | 'instagram';
  onClick: () => void;
  isLoading?: boolean;
}

const providerConfig = {
  google: {
    icon: FaGoogle,
    text: 'Continuar com Google',
    bgColor: 'bg-white hover:bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300',
  },
  facebook: {
    icon: FaFacebook,
    text: 'Continuar com Facebook',
    bgColor: 'bg-[#1877F2] hover:bg-[#166FE5]',
    textColor: 'text-white',
    borderColor: 'border-[#1877F2]',
  },
  instagram: {
    icon: FaInstagram,
    text: 'Continuar com Instagram',
    bgColor: 'bg-gradient-to-r from-[#833AB4] to-[#E1306C] hover:from-[#6E2E9B] hover:to-[#C12458]',
    textColor: 'text-white',
    borderColor: 'border-transparent',
  },
};

export function SocialLoginButton({ provider, onClick, isLoading }: SocialLoginButtonProps) {
  const config = providerConfig[provider];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
        border ${config.borderColor} ${config.bgColor} ${config.textColor}
        font-medium transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
      `}
    >
      <Icon className="h-5 w-5" />
      <span>{isLoading ? 'Conectando...' : config.text}</span>
    </button>
  );
}