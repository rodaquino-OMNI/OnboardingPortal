'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { AlertTriangle, Shield, Activity, Users, Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RoleBasedAccess, { PERMISSIONS, usePermissions } from '@/components/admin/RoleBasedAccess';
import { RealWebSocketClient, createWebSocketConnection } from '@/lib/websocket';

// ===== TYPES =====
export interface RealTimeAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  category: 'health' | 'security' | 'system' | 'compliance' | 'performance';
  title: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  source: string;
  metadata?: Record<string, unknown>;
  actionRequired: boolean;
  autoResolve: boolean;
  escalationLevel: number;
}

export interface AlertSubscription {
  id: string;
  categories: string[];
  priorities: string[];
  types: string[];
  active: boolean;
  userId: string;
}

export interface AlertContextType {
  alerts: RealTimeAlert[];
  unreadCount: number;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Actions
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  markAllAsRead: () => void;
  
  // Subscriptions
  subscribe: (subscription: Omit<AlertSubscription, 'id' | 'userId'>) => void;
  unsubscribe: (subscriptionId: string) => void;
  getActiveSubscriptions: () => AlertSubscription[];
  
  // Filters
  filteredAlerts: RealTimeAlert[];
  setFilter: (filter: AlertFilter) => void;
  currentFilter: AlertFilter;
}

export interface AlertFilter {
  categories?: string[];
  types?: string[];
  priorities?: string[];
  resolved?: boolean;
  acknowledged?: boolean;
}

interface AlertProviderProps {
  children: ReactNode;
  maxAlerts?: number;
  enableToasts?: boolean;
  enableSound?: boolean;
  autoConnect?: boolean;
}

// ===== WEBSOCKET CHANNELS =====
const WEBSOCKET_CHANNELS = {
  HEALTH_ALERTS: 'private-health.alerts',
  ADMIN_ALERTS: 'private-admin.alerts', 
  SYSTEM_ALERTS: 'private-admin.system',
  PUBLIC_DEMO: 'health.alerts' // For demonstration - public channel
} as const;

const WEBSOCKET_EVENTS = {
  HEALTH_RISK_ALERT: 'HealthRiskAlert', // Laravel event class names
  SYSTEM_ALERT: 'SystemAlert'
} as const;

// ===== CONTEXT =====
const AlertContext = createContext<AlertContextType | null>(null);

// ===== PROVIDER =====
export function RealTimeAlertsProvider({
  children,
  maxAlerts = 100,
  enableToasts = true,
  enableSound = false,
  autoConnect = true
}: AlertProviderProps) {
  const [alerts, setAlerts] = useState<RealTimeAlert[]>([]);
  const [subscriptions, setSubscriptions] = useState<AlertSubscription[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AlertContextType['connectionStatus']>('disconnected');
  const [currentFilter, setCurrentFilter] = useState<AlertFilter>({});
  const wsRef = useRef<RealWebSocketClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelSubscriptions = useRef<any[]>([]);
  const { checkPermission } = usePermissions();

  // Filter alerts based on current filter
  const filteredAlerts = React.useMemo(() => {
    return alerts.filter(alert => {
      if (currentFilter.categories && currentFilter.categories.length > 0) {
        if (!currentFilter.categories.includes(alert.category)) return false;
      }
      if (currentFilter.types && currentFilter.types.length > 0) {
        if (!currentFilter.types.includes(alert.type)) return false;
      }
      if (currentFilter.priorities && currentFilter.priorities.length > 0) {
        if (!currentFilter.priorities.includes(alert.priority)) return false;
      }
      if (currentFilter.resolved !== undefined) {
        if (alert.resolved !== currentFilter.resolved) return false;
      }
      if (currentFilter.acknowledged !== undefined) {
        const isAcknowledged = Boolean(alert.acknowledgedAt);
        if (isAcknowledged !== currentFilter.acknowledged) return false;
      }
      return true;
    });
  }, [alerts, currentFilter]);

  // Calculate unread count
  const unreadCount = React.useMemo(() => {
    return alerts.filter(alert => !alert.resolved && !alert.acknowledgedAt).length;
  }, [alerts]);

  // WebSocket connection management
  const connect = useCallback(() => {
    if (!checkPermission(PERMISSIONS.SECURITY_MONITOR)) {
      console.warn('User does not have permission to monitor alerts');
      return;
    }

    if (wsRef.current?.isConnected()) return; // Already connected

    setConnectionStatus('connecting');
    
    try {
      // Create real WebSocket connection with Laravel Echo
      wsRef.current = createWebSocketConnection({
        enableReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        enableLogging: true, // Always enable logging to see connection status
        authToken: localStorage.getItem('auth_token') || undefined
      });
      
      wsRef.current.addEventListener('open', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('Alert WebSocket connected');
        
        // Subscribe to channels
        subscribeToChannels();
      });
      
      wsRef.current.addEventListener('close', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        console.log('Alert WebSocket disconnected');
        
        // Clear channel subscriptions
        channelSubscriptions.current = [];
        
        // Auto-reconnect after 5 seconds
        if (autoConnect) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      });
      
      wsRef.current.addEventListener('error', (error) => {
        setConnectionStatus('error');
        console.error('Alert WebSocket error:', error);
      });
      
    } catch (error) {
      setConnectionStatus('error');
      console.error('Failed to connect to alert WebSocket:', error);
    }
  }, [subscriptions, checkPermission, autoConnect]);

  // Subscribe to WebSocket channels
  const subscribeToChannels = useCallback(() => {
    if (!wsRef.current) return;

    // Clear existing subscriptions
    channelSubscriptions.current = [];

    // Subscribe to public demo channel (no auth required)
    const publicChannel = wsRef.current.subscribeToChannel(
      WEBSOCKET_CHANNELS.PUBLIC_DEMO,
      WEBSOCKET_EVENTS.HEALTH_RISK_ALERT,
      (event: any) => {
        try {
          console.log('Received health risk alert event:', event);
          const alertData = typeof event.data === 'string' ? JSON.parse(event.data) : event;
          
          // Handle different event data structures
          if (alertData.alert) {
            handleNewAlert(alertData.alert);
          } else if (alertData.data && alertData.data.alert) {
            handleNewAlert(alertData.data.alert);
          } else if (alertData.id) {
            // Direct alert object
            handleNewAlert(alertData);
          } else {
            console.warn('Unknown alert data structure:', alertData);
          }
        } catch (error) {
          console.error('Failed to parse health risk alert message:', error, event);
        }
      }
    );

    if (publicChannel) {
      channelSubscriptions.current.push(publicChannel);
    }

    // Subscribe to system alerts on public demo channel
    const systemChannel = wsRef.current.subscribeToChannel(
      WEBSOCKET_CHANNELS.PUBLIC_DEMO,
      WEBSOCKET_EVENTS.SYSTEM_ALERT,
      (event: any) => {
        try {
          console.log('Received system alert event:', event);
          const alertData = typeof event.data === 'string' ? JSON.parse(event.data) : event;
          
          // Handle different event data structures
          if (alertData.alert) {
            handleNewAlert(alertData.alert);
          } else if (alertData.data && alertData.data.alert) {
            handleNewAlert(alertData.data.alert);
          } else if (alertData.id) {
            // Direct alert object
            handleNewAlert(alertData);
          } else {
            console.warn('Unknown system alert data structure:', alertData);
          }
        } catch (error) {
          console.error('Failed to parse system alert message:', error, event);
        }
      }
    );

    if (systemChannel) {
      channelSubscriptions.current.push(systemChannel);
    }

    // Try to subscribe to private channels if authenticated
    try {
      const healthChannel = wsRef.current.subscribeToChannel(
        WEBSOCKET_CHANNELS.HEALTH_ALERTS,
        WEBSOCKET_EVENTS.HEALTH_RISK_ALERT,
        (event: any) => {
          try {
            const alertData = JSON.parse(event.data);
            if (alertData.alert) {
              handleNewAlert(alertData.alert);
            }
          } catch (error) {
            console.error('Failed to parse health alert message:', error);
          }
        }
      );

      if (healthChannel) {
        channelSubscriptions.current.push(healthChannel);
      }
    } catch (error) {
      console.warn('Could not subscribe to private channels (authentication may be required)', error);
    }

    console.log(`Subscribed to ${channelSubscriptions.current.length} channels`);
  }, [handleNewAlert]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Unsubscribe from all channels
    channelSubscriptions.current.forEach(channel => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    });
    channelSubscriptions.current = [];
    
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  // Handle new alert
  const handleNewAlert = useCallback((alertData: RealTimeAlert) => {
    setAlerts(prev => {
      // Remove oldest alert if at max capacity
      const newAlerts = prev.length >= maxAlerts ? prev.slice(1) : prev;
      
      // Add new alert
      const updatedAlerts = [...newAlerts, alertData];
      
      // Show toast notification if enabled
      if (enableToasts) {
        const icon = getAlertIcon(alertData.category);
        const variant = getToastVariant(alertData.type);
        
        toast({
          title: alertData.title,
          description: alertData.message,
          variant,
          duration: alertData.priority === 'critical' ? 0 : 5000 // Critical alerts don't auto-dismiss
        });
      }
      
      // Play sound if enabled and high priority
      if (enableSound && (alertData.priority === 'high' || alertData.priority === 'critical')) {
        playAlertSound(alertData.type);
      }
      
      return updatedAlerts;
    });
  }, [maxAlerts, enableToasts, enableSound]);

  // Alert actions
  const acknowledgeAlert = useCallback((alertId: string) => {
    if (!checkPermission(PERMISSIONS.SECURITY_MONITOR)) return;
    
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledgedAt: new Date().toISOString(), acknowledgedBy: 'current_user' }
        : alert
    ));
  }, [checkPermission]);

  const resolveAlert = useCallback((alertId: string) => {
    if (!checkPermission(PERMISSIONS.ADMIN_UPDATE)) return;
    
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, resolved: true, acknowledgedAt: alert.acknowledgedAt || new Date().toISOString() }
        : alert
    ));
    
    // Send resolution to server via REST API
    fetch('/api/alerts/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(localStorage.getItem('auth_token') && {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        })
      },
      body: JSON.stringify({ alertId })
    }).catch(error => {
      console.error('Failed to resolve alert on server:', error);
    });
  }, [checkPermission]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const clearAllAlerts = useCallback(() => {
    if (!checkPermission(PERMISSIONS.ADMIN_UPDATE)) return;
    setAlerts([]);
  }, [checkPermission]);

  const markAllAsRead = useCallback(() => {
    const now = new Date().toISOString();
    setAlerts(prev => prev.map(alert => 
      alert.acknowledgedAt ? alert : { ...alert, acknowledgedAt: now, acknowledgedBy: 'current_user' }
    ));
  }, []);

  // Subscription management
  const subscribe = useCallback((subscription: Omit<AlertSubscription, 'id' | 'userId'>) => {
    const newSubscription: AlertSubscription = {
      ...subscription,
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'current_user'
    };
    
    setSubscriptions(prev => [...prev, newSubscription]);
    
    // Send subscription to server via REST API
    fetch('/api/alerts/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(localStorage.getItem('auth_token') && {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        })
      },
      body: JSON.stringify(newSubscription)
    }).catch(error => {
      console.error('Failed to save subscription on server:', error);
    });
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    setSubscriptions(prev => {
      const updated = prev.filter(sub => sub.id !== subscriptionId);
      
      // Send unsubscription to server via REST API
      fetch('/api/alerts/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(localStorage.getItem('auth_token') && {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          })
        },
        body: JSON.stringify({ subscriptionId })
      }).catch(error => {
        console.error('Failed to remove subscription on server:', error);
      });
      
      return updated;
    });
  }, []);

  const getActiveSubscriptions = useCallback(() => {
    return subscriptions.filter(sub => sub.active);
  }, [subscriptions]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Auto-resolve alerts if configured
  useEffect(() => {
    const interval = setInterval(() => {
      setAlerts(prev => prev.map(alert => {
        if (alert.autoResolve && !alert.resolved) {
          const alertAge = Date.now() - new Date(alert.timestamp).getTime();
          if (alertAge > 300000) { // Auto-resolve after 5 minutes
            return { ...alert, resolved: true };
          }
        }
        return alert;
      }));
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  const contextValue: AlertContextType = {
    alerts,
    unreadCount,
    isConnected,
    connectionStatus,
    acknowledgeAlert,
    resolveAlert,
    dismissAlert,
    clearAllAlerts,
    markAllAsRead,
    subscribe,
    unsubscribe,
    getActiveSubscriptions,
    filteredAlerts,
    setFilter: setCurrentFilter,
    currentFilter
  };

  return (
    <RoleBasedAccess
      requiredPermissions={[PERMISSIONS.SECURITY_MONITOR]}
      fallback={<>{children}</>}
    >
      <AlertContext.Provider value={contextValue}>
        {children}
      </AlertContext.Provider>
    </RoleBasedAccess>
  );
}

// ===== HOOK =====
export function useRealTimeAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useRealTimeAlerts must be used within a RealTimeAlertsProvider');
  }
  return context;
}

// ===== ALERT NOTIFICATION COMPONENT =====
export function AlertNotification({ alert, onAcknowledge, onResolve, onDismiss }: {
  alert: RealTimeAlert;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const getAlertColor = () => {
    switch (alert.type) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-yellow-500 bg-yellow-50';
      case 'info': return 'border-blue-500 bg-blue-50';
      case 'success': return 'border-green-500 bg-green-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getIcon = () => {
    return getAlertIcon(alert.category);
  };

  return (
    <Card className={`${getAlertColor()} border-l-4 transition-all hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              {getIcon()}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-medium text-sm">{alert.title}</h4>
                <Badge variant={getBadgeVariant(alert.priority)}>
                  {alert.priority}
                </Badge>
                {alert.actionRequired && (
                  <Badge variant="destructive">Action Required</Badge>
                )}
                {alert.acknowledgedAt && (
                  <Badge variant="secondary">Acknowledged</Badge>
                )}
                {alert.resolved && (
                  <Badge variant="outline">Resolved</Badge>
                )}
              </div>
              <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
                <div className="flex items-center space-x-2">
                  {!alert.acknowledgedAt && onAcknowledge && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAcknowledge(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {!alert.resolved && onResolve && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResolve(alert.id)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(alert.id)}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== UTILITY FUNCTIONS =====
function getAlertIcon(category: RealTimeAlert['category']) {
  switch (category) {
    case 'health': return <Activity className="h-5 w-5 text-red-500" />;
    case 'security': return <Shield className="h-5 w-5 text-yellow-500" />;
    case 'system': return <AlertTriangle className="h-5 w-5 text-blue-500" />;
    case 'compliance': return <Shield className="h-5 w-5 text-purple-500" />;
    case 'performance': return <Activity className="h-5 w-5 text-orange-500" />;
    default: return <Bell className="h-5 w-5 text-gray-500" />;
  }
}

function getToastVariant(type: RealTimeAlert['type']) {
  switch (type) {
    case 'critical': return 'destructive' as const;
    case 'warning': return 'default' as const;
    case 'success': return 'default' as const;
    default: return 'default' as const;
  }
}

function getBadgeVariant(priority: RealTimeAlert['priority']) {
  switch (priority) {
    case 'critical': return 'destructive' as const;
    case 'high': return 'destructive' as const;
    case 'medium': return 'default' as const;
    case 'low': return 'secondary' as const;
    default: return 'outline' as const;
  }
}

function playAlertSound(type: RealTimeAlert['type']) {
  // In a real implementation, you would play appropriate sounds
  // For now, we'll just use the browser's default notification sound
  if ('Notification' in window && Notification.permission === 'granted') {
    // Create a silent notification to trigger system sound
    new Notification('', { silent: false, tag: 'alert-sound' });
  }
}

// ===== EXPORTS =====
export default RealTimeAlertsProvider;
export { AlertContext };
