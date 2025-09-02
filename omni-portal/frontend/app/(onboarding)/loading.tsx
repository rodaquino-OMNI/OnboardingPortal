import { Loader2, Heart } from 'lucide-react';

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-xl">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -inset-4 bg-gradient-to-br from-blue-300 to-purple-300 rounded-full opacity-30 animate-ping"></div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Carregando Onboarding
        </h2>
        
        <p className="text-gray-600 mb-6 max-w-md">
          Preparando sua experiência de onboarding personalizada...
        </p>
        
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="text-sm text-gray-500">Carregando</span>
        </div>
      </div>
    </div>
  );
}