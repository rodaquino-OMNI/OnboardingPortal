'use client';

import { Rocket, User, Shield, Heart, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export function IconTest() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
        <p className="text-red-800">Icons loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
      <h3 className="text-green-800 font-semibold mb-4">Icon Test (Client-side rendered)</h3>
      <div className="flex gap-4 items-center">
        <Rocket className="w-8 h-8 text-blue-600" />
        <User className="w-8 h-8 text-green-600" />
        <Shield className="w-8 h-8 text-purple-600" />
        <Heart className="w-8 h-8 text-red-600" />
        <CheckCircle className="w-8 h-8 text-emerald-600" />
      </div>
      <p className="text-green-700 text-sm mt-2">
        If you can see colored icons above, lucide-react is working properly.
      </p>
    </div>
  );
}