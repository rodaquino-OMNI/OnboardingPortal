'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { AlertTriangle, Shield, Activity, Users, Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RoleBasedAccess, { PERMISSIONS, usePermissions } from '@/components/admin/RoleBasedAccess';

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

// ===== MOCK WEBSOCKET IMPLEMENTATION =====
class MockWebSocket {
  private listeners: { [key: string]: Function[] } = {};
  private interval: NodeJS.Timeout | null = null;
  public readyState: number = 0; // CONNECTING

  constructor(private url: string) {
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.emit('open', {});
      this.startMockData();
    }, 1000);
  }

  private startMockData() {
    this.interval = setInterval(() => {
      if (Math.random() < 0.3) { // 30% chance of new alert every 10 seconds
        const mockAlert = this.generateMockAlert();
        this.emit('message', { data: JSON.stringify(mockAlert) });
      }
    }, 10000);
  }

  private generateMockAlert(): RealTimeAlert {
    const categories = ['health', 'security', 'system', 'compliance', 'performance'];
    const types = ['critical', 'warning', 'info'] as const;
    const priorities = ['low', 'medium', 'high', 'critical'] as const;
    
    const category = categories[Math.floor(Math.random() * categories.length)] as RealTimeAlert['category'];
    const type = types[Math.floor(Math.random() * types.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    const messages = {
      health: [
        'High-risk patient detected in questionnaire responses',
        'Unusual health pattern identified requiring review',
        'Mental health screening flagged for immediate attention',
        'Chronic condition progression detected in patient data'
      ],
      security: [
        'Multiple failed login attempts detected',
        'Suspicious activity from unusual IP address',
        'Potential data breach attempt blocked',
        'Unauthorized access attempt to admin panel'
      ],
      system: [
        'Database performance degradation detected',
        'High memory usage on application server',
        'API response times exceeding threshold',
        'Backup process completed with warnings'
      ],
      compliance: [
        'LGPD consent expiration approaching for users',
        'Audit trail discrepancy detected',
        'Data retention policy violation flagged',
        'Privacy policy acceptance required for users'
      ],
      performance: [
        'System response time exceeding SLA thresholds',
        'High CPU utilization on web servers',
        'Database connection pool nearly exhausted',
        'CDN performance degradation detected'
      ]
    };

    const categoryMessages = messages[category];
    const message = categoryMessages[Math.floor(Math.random() * categoryMessages.length)];
    
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category,
      title: `${category.charAt(0).toUpperCase() + category.slice(1)} Alert`,
      message,
      timestamp: new Date().toISOString(),
      priority,
      resolved: false,
      source: 'monitoring_system',
      actionRequired: type === 'critical' || priority === 'critical',
      autoResolve: type === 'info',
      escalationLevel: 0,
      metadata: {
        generatedBy: 'mock_system',
        environment: 'production'
      }
    };
  }

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.emit('close', {});
  }

  send(data: string) {
    // Mock send implementation
    console.log('MockWebSocket send:', data);
  }
}

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
  const wsRef = useRef<MockWebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

    if (wsRef.current?.readyState === 1) return; // Already connected

    setConnectionStatus('connecting');
    
    try {
      // In a real implementation, this would be a proper WebSocket URL
      wsRef.current = new MockWebSocket('wss://api.example.com/alerts');
      
      wsRef.current.addEventListener('open', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('Alert WebSocket connected');
        
        // Send subscription preferences
        subscriptions.forEach(subscription => {
          wsRef.current?.send(JSON.stringify({
            type: 'subscribe',
            subscription
          }));
        });
      });
      
      wsRef.current.addEventListener('message', (event: any) => {
        try {
          const alertData = JSON.parse(event.data);
          handleNewAlert(alertData);
        } catch (error) {
          console.error('Failed to parse alert message:', error);
        }
      });
      
      wsRef.current.addEventListener('close', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        console.log('Alert WebSocket disconnected');
        
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

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
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
    
    // Send resolution to server
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        type: 'resolve_alert',
        alertId
      }));
    }
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
    
    // Send subscription to server
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        subscription: newSubscription
      }));
    }
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    setSubscriptions(prev => {
      const updated = prev.filter(sub => sub.id !== subscriptionId);
      
      // Send unsubscription to server
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          subscriptionId
        }));
      }
      
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
