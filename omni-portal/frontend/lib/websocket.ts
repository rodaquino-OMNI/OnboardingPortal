import Pusher from 'pusher-js';
import Echo from 'laravel-echo';

// Laravel Echo configuration for Laravel Reverb
export const WEBSOCKET_CONFIG = {
  host: process.env.NEXT_PUBLIC_PUSHER_HOST || 'localhost',
  port: parseInt(process.env.NEXT_PUBLIC_PUSHER_PORT || '8080'),
  scheme: process.env.NEXT_PUBLIC_PUSHER_SCHEME || 'http',
  appKey: process.env.NEXT_PUBLIC_PUSHER_APP_KEY || 'vra4m4ukxphhlhweav9m',
  cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER || 'mt1',
  encrypted: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
  forceTLS: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
  enabledTransports: ['ws', 'wss'],
  disableStats: true,
  authEndpoint: process.env.NEXT_PUBLIC_BROADCASTING_AUTH_ENDPOINT || 'http://localhost:8000/broadcasting/auth',
  auth: {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    }
  }
};

// Global Echo instance
let echoInstance: Echo | null = null;

export interface WebSocketConnectionOptions {
  enableReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableLogging?: boolean;
  authToken?: string;
}

export class RealWebSocketClient {
  private echo: Echo | null = null;
  private pusher: Pusher | null = null;
  private connectionOptions: WebSocketConnectionOptions;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private listeners: { [key: string]: ((...args: any[]) => void)[] } = {};
  private channels: { [key: string]: any } = {};

  public readyState: number = 0; // CONNECTING

  constructor(
    private url: string,
    options: WebSocketConnectionOptions = {}
  ) {
    this.connectionOptions = {
      enableReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      enableLogging: false,
      ...options
    };

    this.initializeConnection();
  }

  private initializeConnection() {
    if (this.isConnecting || this.echo) return;

    this.isConnecting = true;
    
    try {
      // Initialize Laravel Echo with Pusher client for Laravel Reverb
      this.echo = new Echo({
        broadcaster: 'pusher',
        key: WEBSOCKET_CONFIG.appKey,
        wsHost: WEBSOCKET_CONFIG.host,
        wsPort: WEBSOCKET_CONFIG.port,
        wssPort: WEBSOCKET_CONFIG.port,
        forceTLS: WEBSOCKET_CONFIG.forceTLS,
        encrypted: WEBSOCKET_CONFIG.encrypted,
        disableStats: WEBSOCKET_CONFIG.disableStats,
        enabledTransports: WEBSOCKET_CONFIG.enabledTransports,
        cluster: WEBSOCKET_CONFIG.cluster,
        authEndpoint: WEBSOCKET_CONFIG.authEndpoint,
        auth: {
          ...WEBSOCKET_CONFIG.auth,
          headers: {
            ...WEBSOCKET_CONFIG.auth.headers,
            ...(this.connectionOptions.authToken && {
              'Authorization': `Bearer ${this.connectionOptions.authToken}`
            })
          }
        }
      });

      // Get the underlying Pusher instance
      this.pusher = (this.echo as any).connector.pusher;

      // Enable Pusher logging in development
      if (this.connectionOptions.enableLogging && process.env.NODE_ENV === 'development') {
        Pusher.logToConsole = true;
      }

      // Connection event handlers
      this.pusher.connection.bind('connected', () => {
        this.readyState = 1; // OPEN
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('open', {});
        
        if (this.connectionOptions.enableLogging) {
          console.log('Laravel Echo WebSocket connected successfully to Reverb server');
          console.log('Connection state:', this.pusher?.connection.state);
          console.log('Socket ID:', this.pusher?.connection.socket_id);
        }
      });

      this.pusher.connection.bind('disconnected', () => {
        this.readyState = 3; // CLOSED
        this.isConnecting = false;
        this.emit('close', {});
        
        if (this.connectionOptions.enableLogging) {
          console.log('Laravel Echo WebSocket disconnected from Reverb server');
        }

        this.handleReconnection();
      });

      this.pusher.connection.bind('error', (error: any) => {
        this.readyState = 3; // CLOSED
        this.isConnecting = false;
        this.emit('error', error);
        
        if (this.connectionOptions.enableLogging) {
          console.error('Laravel Echo WebSocket error:', error);
        }

        this.handleReconnection();
      });

      this.pusher.connection.bind('state_change', (states: any) => {
        if (this.connectionOptions.enableLogging) {
          console.log('Laravel Echo connection state change:', states.previous, '->', states.current);
        }
      });

      // Store global instance
      echoInstance = this.echo;

    } catch (error) {
      this.isConnecting = false;
      this.readyState = 3; // CLOSED
      this.emit('error', error);
      
      if (this.connectionOptions.enableLogging) {
        console.error('Failed to initialize Laravel Echo connection:', error);
      }
    }
  }

  private handleReconnection() {
    if (!this.connectionOptions.enableReconnect) return;
    
    if (this.reconnectAttempts >= (this.connectionOptions.maxReconnectAttempts || 5)) {
      if (this.connectionOptions.enableLogging) {
        console.error('Max reconnection attempts reached');
      }
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      if (this.connectionOptions.enableLogging) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.connectionOptions.maxReconnectAttempts})...`);
      }
      
      this.disconnect();
      this.initializeConnection();
    }, this.connectionOptions.reconnectDelay || 3000);
  }

  public subscribeToChannel(channelName: string, eventName: string, callback: (data: any) => void) {
    if (!this.echo) {
      console.error('Laravel Echo not initialized');
      return null;
    }

    let channel;
    
    // Determine channel type based on name prefix
    if (channelName.startsWith('private-')) {
      const privateName = channelName.replace('private-', '');
      channel = this.echo.private(privateName);
    } else if (channelName.startsWith('presence-')) {
      const presenceName = channelName.replace('presence-', '');
      channel = this.echo.join(presenceName);
    } else {
      // Public channel
      channel = this.echo.channel(channelName);
    }
    
    // Listen for the event
    channel.listen(eventName, (data: any) => {
      // Format data to match expected structure
      const formattedData = {
        data: JSON.stringify(data)
      };
      callback(formattedData);
    });

    // Store channel reference for cleanup
    this.channels[channelName] = channel;

    if (this.connectionOptions.enableLogging) {
      console.log(`Laravel Echo subscribed to channel: ${channelName}, event: ${eventName}`);
    }

    return channel;
  }

  public unsubscribeFromChannel(channelName: string) {
    if (this.echo && this.channels[channelName]) {
      // Laravel Echo handles unsubscription automatically when references are lost
      // But we can explicitly leave channels if needed
      const channel = this.channels[channelName];
      if (channel && typeof channel.stopListening === 'function') {
        channel.stopListening();
      }
      
      delete this.channels[channelName];
      
      if (this.connectionOptions.enableLogging) {
        console.log(`Laravel Echo unsubscribed from channel: ${channelName}`);
      }
    }
  }

  public addEventListener(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  public removeEventListener(event: string, callback: (...args: any[]) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  public disconnect() {
    // Cleanup all channels
    Object.keys(this.channels).forEach(channelName => {
      this.unsubscribeFromChannel(channelName);
    });
    this.channels = {};
    
    if (this.echo) {
      this.echo.disconnect();
      this.echo = null;
    }
    
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
    
    // Clear global instance
    if (echoInstance === this.echo) {
      echoInstance = null;
    }
    
    this.readyState = 3; // CLOSED
    this.isConnecting = false;
  }

  public send(data: string) {
    // For demonstration - in real usage you'd typically use REST API to send data
    if (this.connectionOptions.enableLogging) {
      console.log('Laravel Echo WebSocket send (via REST API):', data);
    }
    
    // You could implement a REST call here to send data to the server
    // which would then broadcast it via WebSocket
  }

  public getConnectionState() {
    return this.pusher?.connection.state || 'disconnected';
  }

  public isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }

  // Get the underlying Echo instance
  public getEchoInstance(): Echo | null {
    return this.echo;
  }
}

// Export singleton instance for global use
export const createWebSocketConnection = (options?: WebSocketConnectionOptions): RealWebSocketClient => {
  const wsUrl = `${WEBSOCKET_CONFIG.scheme === 'https' ? 'wss' : 'ws'}://${WEBSOCKET_CONFIG.host}:${WEBSOCKET_CONFIG.port}`;
  return new RealWebSocketClient(wsUrl, options);
};

// Get global Echo instance
export const getEchoInstance = (): Echo | null => {
  return echoInstance;
};

// Health check function
export const testWebSocketConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const testClient = createWebSocketConnection({
      enableLogging: true,
      enableReconnect: false
    });

    const timeout = setTimeout(() => {
      testClient.disconnect();
      resolve(false);
    }, 10000); // Increase timeout to 10 seconds for real connection

    testClient.addEventListener('open', () => {
      clearTimeout(timeout);
      testClient.disconnect();
      resolve(true);
    });

    testClient.addEventListener('error', () => {
      clearTimeout(timeout);
      testClient.disconnect();
      resolve(false);
    });
  });
};