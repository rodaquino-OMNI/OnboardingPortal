'use client';

import React from 'react';
import { Shield, Clock, Users, Zap } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-inter">
      {/* Left side - Auth Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="w-full">
          {children}
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative h-full flex items-center justify-center p-12">
          <div className="max-w-md text-white">
            <h2 className="text-4xl font-bold mb-6 tracking-tight">Bem-vindo ao Portal de Onboarding</h2>
            <p className="text-lg mb-8 opacity-90 leading-relaxed">
              Junte-se a nós e comece sua jornada de forma simples e rápida. 
              Nosso processo de onboarding foi projetado para ser intuitivo e eficiente.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="card-modern bg-white/10 backdrop-blur-sm border-white/20 p-6 hover:bg-white/15 transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold mb-1">100%</div>
                <div className="text-sm opacity-75">Seguro</div>
              </div>
              <div className="card-modern bg-white/10 backdrop-blur-sm border-white/20 p-6 hover:bg-white/15 transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold mb-1">24/7</div>
                <div className="text-sm opacity-75">Suporte</div>
              </div>
              <div className="card-modern bg-white/10 backdrop-blur-sm border-white/20 p-6 hover:bg-white/15 transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold mb-1">5 min</div>
                <div className="text-sm opacity-75">Cadastro rápido</div>
              </div>
              <div className="card-modern bg-white/10 backdrop-blur-sm border-white/20 p-6 hover:bg-white/15 transition-all duration-300">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold mb-1">+1000</div>
                <div className="text-sm opacity-75">Usuários ativos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-purple-400/20 rounded-full blur-2xl animate-pulse" />
      </div>
    </div>
  );
}