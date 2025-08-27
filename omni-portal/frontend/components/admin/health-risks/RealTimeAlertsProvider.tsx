'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from '@/components/ui/toast';
import { healthRisksApi, type ClinicalAlert } from '@/lib/api/admin/health-risks';
import { Bell, AlertTriangle, Activity } from 'lucide-react';

interface RealTimeAlertsContextType {
  newAlertsCount: number;
  latestAlert: ClinicalAlert | null;
  clearNewAlerts: () => void;
  subscribed: boolean;
}

const RealTimeAlertsContext = createContext<RealTimeAlertsContextType | undefined>(undefined);

export function useRealTimeAlerts() {
  const context = useContext(RealTimeAlertsContext);
  if (context === undefined) {
    throw new Error('useRealTimeAlerts must be used within a RealTimeAlertsProvider');
  }
  return context;
}

interface RealTimeAlertsProviderProps {
  children: ReactNode;
}

export function RealTimeAlertsProvider({ children }: RealTimeAlertsProviderProps) {
  const [newAlertsCount, setNewAlertsCount] = useState(0);
  const [latestAlert, setLatestAlert] = useState<ClinicalAlert | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const startSubscription = async () => {
      try {
        unsubscribe = await healthRisksApi.subscribeToAlerts((alert: ClinicalAlert) => {
          setLatestAlert(alert);
          setNewAlertsCount(prev => prev + 1);
          
          // Show toast notification
          const getPriorityIcon = (priority: string) => {
            switch (priority) {
              case 'emergency':
              case 'urgent':
                return <AlertTriangle className="w-4 h-4" />;
              default:
                return <Bell className="w-4 h-4" />;
            }
          };

          const getPriorityColor = (priority: string) => {
            switch (priority) {
              case 'emergency':
                return 'bg-red-100 border-red-500 text-red-900';
              case 'urgent':
                return 'bg-orange-100 border-orange-500 text-orange-900';
              case 'high':
                return 'bg-yellow-100 border-yellow-500 text-yellow-900';
              default:
                return 'bg-blue-100 border-blue-500 text-blue-900';
            }
          };

          toast({
            title: "Novo Alerta de Saúde",
            description: `${alert.beneficiary_name} - ${alert.alert_type}`,
            duration: 8000,
            className: `${getPriorityColor(alert.priority)} border-l-4`,
            action: (
              <div className="flex items-center gap-2">
                {getPriorityIcon(alert.priority)}
                <span className="text-xs font-medium uppercase">
                  {alert.priority}
                </span>
              </div>
            )
          });

          // Trigger browser notification if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Novo Alerta: ${alert.alert_type}`, {
              body: `Paciente: ${alert.beneficiary_name}\nRisco: ${alert.risk_score}`,
              icon: '/favicon.ico',
              tag: alert.id,
              requireInteraction: alert.priority === 'emergency'
            });
          }

          // Play notification sound for high priority alerts
          if (['emergency', 'urgent'].includes(alert.priority)) {
            const audio = new Audio('/sounds/notification.mp3');
            audio.play().catch(() => {
              // Ignore errors if sound can't be played
            });
          }
        });

        setSubscribed(true);
      } catch (error) {
        console.error('Error starting real-time alerts subscription:', error);
        setSubscribed(false);
      }
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    startSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      setSubscribed(false);
    };
  }, []);

  const clearNewAlerts = () => {
    setNewAlertsCount(0);
  };

  const contextValue: RealTimeAlertsContextType = {
    newAlertsCount,
    latestAlert,
    clearNewAlerts,
    subscribed
  };

  return (
    <RealTimeAlertsContext.Provider value={contextValue}>
      {children}
    </RealTimeAlertsContext.Provider>
  );
}

// Real-time notification badge component
interface NotificationBadgeProps {
  className?: string;
}

export function NotificationBadge({ className }: NotificationBadgeProps) {
  const { newAlertsCount, subscribed } = useRealTimeAlerts();

  if (newAlertsCount === 0) return null;

  return (
    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full ${className}`}>
      {newAlertsCount > 99 ? '99+' : newAlertsCount}
      {subscribed && (
        <span className="absolute -top-1 -right-1 h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}
    </span>
  );
}

// Real-time status indicator
export function RealTimeStatus() {
  const { subscribed } = useRealTimeAlerts();

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${subscribed ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={subscribed ? 'text-green-600' : 'text-red-600'}>
        {subscribed ? 'Monitoramento Ativo' : 'Desconectado'}
      </span>
    </div>
  );
}