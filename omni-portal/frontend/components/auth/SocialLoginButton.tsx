import React from 'react';
import { FaGoogle, FaFacebook, FaInstagram } from 'react-icons/fa';
import { cn } from '@/lib/utils';

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
    shadow: 'shadow-sm hover:shadow-md',
  },
  facebook: {
    icon: FaFacebook,
    text: 'Continuar com Facebook',
    bgColor: 'bg-[#1877F2] hover:bg-[#166FE5]',
    textColor: 'text-white',
    borderColor: 'border-[#1877F2]',
    shadow: 'shadow-sm hover:shadow-md',
  },
  instagram: {
    icon: FaInstagram,
    text: 'Continuar com Instagram',
    bgColor: 'bg-gradient-to-r from-[#833AB4] to-[#E1306C] hover:from-[#6E2E9B] hover:to-[#C12458]',
    textColor: 'text-white',
    borderColor: 'border-transparent',
    shadow: 'shadow-md hover:shadow-lg',
  },
};

export function SocialLoginButton({ provider, onClick, isLoading }: SocialLoginButtonProps) {
  const config = providerConfig[provider];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg",
        "border font-medium transition-all duration-300 transform",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
        "hover:transform hover:-translate-y-0.5",
        config.borderColor,
        config.bgColor,
        config.textColor,
        config.shadow
      )}
    >
      {isLoading ? (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Conectando...</span>
        </div>
      ) : (
        <>
          <Icon className="h-5 w-5" />
          <span>{config.text}</span>
        </>
      )}
    </button>
  );
}