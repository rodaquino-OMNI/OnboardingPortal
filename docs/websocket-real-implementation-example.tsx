/**
 * EXAMPLE: Real WebSocket Implementation
 * 
 * This shows how to replace the MockWebSocket in RealTimeAlertsProvider
 * with a real Pusher WebSocket connection for production.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import Pusher from 'pusher-js';
import { toast } from '@/components/ui/use-toast';

// Types remain the same as in original implementation
export interface RealTimeAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  category: 'health' | 'security' | 'system' | 'compliance' | 'performance';
  title: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  source: string;
  actionRequired: boolean;
  autoResolve: boolean;
  escalationLevel: number;
}

/**
 * PRODUCTION READY: Real WebSocket Alerts Provider
 * 
 * This replaces the MockWebSocket implementation with actual
 * Pusher WebSocket connections for real-time functionality.
 */
export function RealTimeAlertsProvider({
  children,
  maxAlerts = 100,
  enableToasts = true,
  enableSound = false,
  autoConnect = true
}: {
  children: ReactNode;
  maxAlerts?: number;
  enableToasts?: boolean;
  enableSound?: boolean;
  autoConnect?: boolean;
}) {
  const [alerts, setAlerts] = useState<RealTimeAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  // Real Pusher connection refs
  const pusherRef = useRef<Pusher | null>(null);
  const channelsRef = useRef<Map<string, any>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * REAL WebSocket Connection Management
   * This replaces the mock connection with actual Pusher WebSocket
   */
  const connect = useCallback(async () => {
    if (pusherRef.current?.connection.state === 'connected') return;

    setConnectionStatus('connecting');
    
    try {
      // Get authentication token
      const authToken = await getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      // Initialize real Pusher connection
      pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        encrypted: true,
        authEndpoint: '/api/broadcasting/auth',
        auth: {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json',
          },
        },
        // Enable connection logging in development
        enabledTransports: ['ws', 'wss'],
        disabledTransports: [], // Allow all transports
        activityTimeout: 120000, // 2 minutes
        pongTimeout: 30000, // 30 seconds
      });

      // Real connection event handlers
      pusherRef.current.connection.bind('connected', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('✅ Real WebSocket connected to Pusher');
        
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      });

      pusherRef.current.connection.bind('disconnected', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        console.log('❌ Real WebSocket disconnected from Pusher');
        
        // Auto-reconnect after delay
        if (autoConnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }, 5000);
        }
      });

      pusherRef.current.connection.bind('error', (error: any) => {
        setConnectionStatus('error');
        console.error('❌ Real WebSocket error:', error);
        
        // Show user-friendly error message
        if (enableToasts) {
          toast({
            title: 'Connection Error',
            description: 'Lost connection to real-time alerts. Attempting to reconnect...',
            variant: 'destructive',
          });
        }
      });

      // Subscribe to real channels with actual server communication
      await subscribeToChannels();

    } catch (error) {
      setConnectionStatus('error');
      console.error('❌ Failed to connect to real WebSocket:', error);
      
      if (enableToasts) {
        toast({
          title: 'Connection Failed',
          description: 'Unable to connect to real-time alerts. Please refresh the page.',
          variant: 'destructive',
        });
      }
    }
  }, [autoConnect, enableToasts]);

  /**
   * Subscribe to real Pusher channels
   * These channels receive actual server-sent messages
   */
  const subscribeToChannels = useCallback(async () => {
    if (!pusherRef.current) return;

    try {
      // Subscribe to admin notification channel
      const adminChannel = pusherRef.current.subscribe('private-admin.notifications');
      channelsRef.current.set('admin.notifications', adminChannel);

      adminChannel.bind('admin.notification', (data: RealTimeAlert) => {
        console.log('📨 Received real admin notification:', data);
        handleNewAlert(data);
      });

      adminChannel.bind('pusher:subscription_error', (error: any) => {
        console.error('❌ Admin channel subscription error:', error);
      });

      // Subscribe to health alerts channel  
      const healthChannel = pusherRef.current.subscribe('private-admin.health-alerts');
      channelsRef.current.set('admin.health-alerts', healthChannel);

      healthChannel.bind('health.alert', (data: RealTimeAlert) => {
        console.log('🏥 Received real health alert:', data);
        handleNewAlert(data);
      });

      // Subscribe to security alerts channel
      const securityChannel = pusherRef.current.subscribe('private-admin.security');
      channelsRef.current.set('admin.security', securityChannel);

      securityChannel.bind('admin.notification', (data: RealTimeAlert) => {
        console.log('🔒 Received real security alert:', data);
        handleNewAlert(data);
      });

      // Subscribe to system alerts channel
      const systemChannel = pusherRef.current.subscribe('private-admin.system');
      channelsRef.current.set('admin.system', systemChannel);

      systemChannel.bind('admin.notification', (data: RealTimeAlert) => {
        console.log('⚙️ Received real system alert:', data);
        handleNewAlert(data);
      });

      // Subscribe to performance alerts channel
      const performanceChannel = pusherRef.current.subscribe('private-admin.performance');
      channelsRef.current.set('admin.performance', performanceChannel);

      performanceChannel.bind('admin.notification', (data: RealTimeAlert) => {
        console.log('⚡ Received real performance alert:', data);
        handleNewAlert(data);
      });

      console.log('✅ Subscribed to all real WebSocket channels');

    } catch (error) {
      console.error('❌ Failed to subscribe to channels:', error);
    }
  }, []);

  /**
   * Handle real alerts from server
   * This processes actual server-sent alerts, not mock data
   */
  const handleNewAlert = useCallback((alertData: RealTimeAlert) => {
    console.log('📨 Processing real alert from server:', alertData);
    
    setAlerts(prev => {
      // Remove oldest alert if at max capacity
      const newAlerts = prev.length >= maxAlerts ? prev.slice(1) : prev;
      
      // Add new real alert from server
      const updatedAlerts = [...newAlerts, {
        ...alertData,
        // Ensure we have all required properties
        timestamp: alertData.timestamp || new Date().toISOString(),
        resolved: alertData.resolved || false,
        escalationLevel: alertData.escalationLevel || 0,
      }];
      
      // Show toast notification for real alerts
      if (enableToasts) {
        toast({
          title: alertData.title,
          description: alertData.message,
          variant: getToastVariant(alertData.type),
          duration: alertData.priority === 'critical' ? 0 : 5000,
        });
      }
      
      // Play sound for high-priority real alerts
      if (enableSound && (alertData.priority === 'high' || alertData.priority === 'critical')) {
        playAlertSound(alertData.type);
      }
      
      return updatedAlerts;
    });
  }, [maxAlerts, enableToasts, enableSound]);

  /**
   * Disconnect from real WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pusherRef.current) {
      // Unsubscribe from all real channels
      channelsRef.current.forEach((channel, channelName) => {
        channel.unbind_all();
        pusherRef.current!.unsubscribe(channelName);
      });
      channelsRef.current.clear();

      // Disconnect from Pusher
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    console.log('🔌 Disconnected from real WebSocket');
  }, []);

  /**
   * Send real message to server
   * This actually communicates with the backend
   */
  const sendMessage = useCallback(async (type: string, payload: any) => {
    if (!pusherRef.current || pusherRef.current.connection.state !== 'connected') {
      console.warn('⚠️ Cannot send message: not connected to real WebSocket');
      return false;
    }

    try {
      // Send via HTTP API since Pusher doesn't support client-to-server messages
      const response = await fetch('/api/websocket/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          type,
          payload,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Message sent to real server:', { type, payload });
      return true;

    } catch (error) {
      console.error('❌ Failed to send message to real server:', error);
      return false;
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Context value with real WebSocket functionality
  const contextValue = {
    alerts,
    unreadCount: alerts.filter(alert => !alert.resolved && !alert.acknowledgedAt).length,
    isConnected,
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
    // ... other functions remain the same
  };

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
    </AlertContext.Provider>
  );
}

/**
 * Helper function to get authentication token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    // Get token from localStorage, cookie, or auth provider
    const token = localStorage.getItem('auth_token') || 
                  document.cookie.match(/auth_token=([^;]+)/)?.[1];
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    return token;
  } catch (error) {
    console.error('❌ Failed to get auth token:', error);
    return null;
  }
}

/**
 * Helper functions (same as original)
 */
function getToastVariant(type: string) {
  switch (type) {
    case 'critical': return 'destructive';
    case 'warning': return 'default';
    case 'success': return 'default';
    default: return 'default';
  }
}

function playAlertSound(type: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('', { silent: false, tag: 'alert-sound' });
  }
}

/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * 
 * Add to .env.local:
 * NEXT_PUBLIC_PUSHER_KEY=your_pusher_key_here
 * NEXT_PUBLIC_PUSHER_CLUSTER=us3
 * NEXT_PUBLIC_APP_URL=https://your-domain.com
 */

/**
 * BACKEND REQUIREMENTS:
 * 
 * 1. Configure Pusher in Laravel .env:
 *    BROADCAST_DRIVER=pusher
 *    PUSHER_APP_ID=your_app_id
 *    PUSHER_APP_KEY=your_app_key  
 *    PUSHER_APP_SECRET=your_app_secret
 *    PUSHER_APP_CLUSTER=us3
 * 
 * 2. Create API endpoint for receiving messages:
 *    Route::post('/api/websocket/message', [WebSocketController::class, 'handleMessage']);
 * 
 * 3. Test broadcasting:
 *    php artisan tinker
 *    broadcast(new AdminNotificationEvent::system('Test message'));
 */

export default RealTimeAlertsProvider;