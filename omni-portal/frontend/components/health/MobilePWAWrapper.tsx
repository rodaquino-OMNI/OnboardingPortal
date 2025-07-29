'use client';

import { useState, useEffect } from 'react';
import { 
  Download, Wifi, WifiOff, RefreshCw, 
  Bell, BellOff, Share2, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';

// Progressive Web App Wrapper for Mobile Health Questionnaire
// Handles PWA installation, offline mode, and native mobile features

interface MobilePWAWrapperProps {
  children: React.ReactNode;
  enableInstallPrompt?: boolean;
  enableNotifications?: boolean;
  enableOfflineMode?: boolean;
}

interface PWACapabilities {
  isInstallable: boolean;
  isInstalled: boolean;
  supportsNotifications: boolean;
  isOnline: boolean;
  supportsBadging: boolean;
  supportsShare: boolean;
}

export function MobilePWAWrapper({
  children,
  enableInstallPrompt = true,
  enableNotifications = true,
  enableOfflineMode = true
}: MobilePWAWrapperProps) {
  const [pwaCapabilities, setPwaCapabilities] = useState<PWACapabilities>({
    isInstallable: false,
    isInstalled: false,
    supportsNotifications: false,
    isOnline: navigator.onLine,
    supportsBadging: false,
    supportsShare: false
  });
  
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Detect PWA capabilities
  useEffect(() => {
    const updateCapabilities = () => {
      setPwaCapabilities({
        isInstallable: !!installPrompt,
        isInstalled: window.matchMedia('(display-mode: standalone)').matches,
        supportsNotifications: 'Notification' in window,
        isOnline: navigator.onLine,
        supportsBadging: 'setAppBadge' in navigator,
        supportsShare: 'share' in navigator
      });
    };

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (enableInstallPrompt) {
        setShowInstallBanner(true);
      }
    };

    // Listen for online/offline status
    const handleOnline = () => setPwaCapabilities(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setPwaCapabilities(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    updateCapabilities();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [installPrompt, enableInstallPrompt]);

  // Handle PWA installation
  const handleInstallPWA = async () => {
    if (!installPrompt) return;

    try {
      const result = await installPrompt.prompt();
      if (result.outcome === 'accepted') {
        setShowInstallBanner(false);
        setInstallPrompt(null);
        
        // Update app badge if supported
        if (pwaCapabilities.supportsBadging) {
          (navigator as any).setAppBadge?.(0);
        }
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
    }
  };

  // Handle notification permission
  const requestNotificationPermission = async () => {
    if (!pwaCapabilities.supportsNotifications) return;

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        // Show welcome notification
        new Notification('Portal de Saúde', {
          body: 'Notificações ativadas! Você receberá lembretes importantes.',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: 'welcome'
        });
      }
    } catch (error) {
      console.error('Notification permission failed:', error);
    }
  };

  // Handle native sharing
  const handleShare = async () => {
    if (!pwaCapabilities.supportsShare) return;

    try {
      await navigator.share({
        title: 'Portal de Saúde',
        text: 'Complete sua avaliação de saúde de forma segura e conveniente',
        url: window.location.href
      });
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

  // Force refresh for updates
  const handleRefresh = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.update();
        });
      });
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PWA Status Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex justify-between items-center">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {pwaCapabilities.isOnline ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm text-gray-600">
              {pwaCapabilities.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* PWA Controls */}
          <div className="flex items-center gap-2">
            {enableNotifications && pwaCapabilities.supportsNotifications && (
              <Button
                variant="ghost"
                size="sm"
                onClick={requestNotificationPermission}
                className={notificationPermission === 'granted' ? 'text-green-600' : ''}
              >
                {notificationPermission === 'granted' ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </Button>
            )}

            {pwaCapabilities.supportsShare && (
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Install App Banner */}
      {showInstallBanner && enableInstallPrompt && (
        <Alert className="m-4 border-blue-200 bg-blue-50">
          <Download className="w-4 h-4" />
          <AlertDescription className="flex justify-between items-center">
            <span>Instale o app para melhor experiência</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleInstallPWA}>
                Instalar
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowInstallBanner(false)}
              >
                Depois
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Offline Mode Banner */}
      {!pwaCapabilities.isOnline && enableOfflineMode && (
        <Alert className="m-4 border-orange-200 bg-orange-50">
          <WifiOff className="w-4 h-4" />
          <AlertDescription>
            Você está offline. Suas respostas serão sincronizadas quando a conexão for restaurada.
          </AlertDescription>
        </Alert>
      )}

      {/* PWA Installation Success */}
      {pwaCapabilities.isInstalled && (
        <Alert className="m-4 border-green-200 bg-green-50">
          <Home className="w-4 h-4" />
          <AlertDescription>
            App instalado com sucesso! Você pode acessá-lo pela tela inicial.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="pb-safe">
        {children}
      </div>

      {/* PWA Features Footer */}
      <div className="bg-white border-t border-gray-200 p-4 pb-safe">
        <div className="text-center space-y-2">
          <div className="text-xs text-gray-500">
            Portal de Saúde PWA • Versão 2.0
          </div>
          
          {pwaCapabilities.isInstalled && (
            <div className="text-xs text-green-600">
              ✓ Instalado como app nativo
            </div>
          )}
          
          {notificationPermission === 'granted' && (
            <div className="text-xs text-blue-600">
              ✓ Notificações ativadas
            </div>
          )}
          
          {enableOfflineMode && (
            <div className="text-xs text-purple-600">
              ✓ Funciona offline
            </div>
          )}
        </div>
      </div>
    </div>
  );
}