'use client';

import React, { useEffect, useState } from 'react';
import { RealTimeAlertsProvider, useRealTimeAlerts } from './RealTimeAlertsProvider';
import { AlertNotification } from './RealTimeAlertsProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Activity, Wifi, WifiOff, Zap, PlayCircle, AlertTriangle } from 'lucide-react';

function WebSocketDemoContent() {
  const { 
    alerts, 
    acknowledgeAlert, 
    resolveAlert, 
    dismissAlert, 
    connectionStatus, 
    isConnected,
    unreadCount 
  } = useRealTimeAlerts();

  const [demoStatus, setDemoStatus] = useState<'idle' | 'running' | 'paused'>('idle');

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'disconnected': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="h-4 w-4" />;
      case 'connecting': return <Activity className="h-4 w-4 animate-pulse" />;
      default: return <WifiOff className="h-4 w-4" />;
    }
  };

  const simulateHealthAlert = () => {
    // This would normally trigger an API call to generate an alert
    // For now, it demonstrates what would happen when a real health event occurs
    console.log('Health alert simulation would trigger API call to backend');
  };

  const startDemo = () => {
    setDemoStatus('running');
    // In a real implementation, this would start a demo sequence
    simulateHealthAlert();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Real-Time WebSocket Health Alerts
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience live health risk monitoring with instant WebSocket notifications.
            This system replaces the previous mock implementation with real server-client communication.
          </p>
        </div>

        {/* Connection Status Bar */}
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${getStatusColor()}`}>
                    {getStatusIcon()}
                    <span className="font-semibold capitalize">
                      {connectionStatus}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {unreadCount} Active Alerts
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-600">
                    <div>WebSocket: <code>localhost:8080</code></div>
                    <div>Backend: <code>Laravel Reverb</code></div>
                  </div>
                  <Button 
                    onClick={startDemo}
                    disabled={!isConnected || demoStatus === 'running'}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Start Demo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Real-time Alerts Feed */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Live Health Alerts
                </CardTitle>
                <CardDescription>
                  Real-time alerts received via WebSocket connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Wifi className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 mb-4">
                        No alerts received yet. The system is ready to receive real-time health notifications.
                      </p>
                      <p className="text-sm text-gray-400">
                        Run <code>php artisan websocket:test</code> in the backend to generate test alerts
                      </p>
                    </div>
                  ) : (
                    alerts
                      .slice()
                      .reverse() // Show newest first
                      .map((alert) => (
                        <AlertNotification
                          key={alert.id}
                          alert={alert}
                          onAcknowledge={acknowledgeAlert}
                          onResolve={resolveAlert}
                          onDismiss={dismissAlert}
                        />
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  WebSocket Implementation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-600">✅ Completed Features</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Laravel Reverb WebSocket server</li>
                    <li>• Real Pusher.js client connection</li>
                    <li>• Event broadcasting system</li>
                    <li>• Channel authentication</li>
                    <li>• Automatic reconnection</li>
                    <li>• Multi-client support</li>
                    <li>• Role-based channel access</li>
                  </ul>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-semibold text-red-600">❌ Removed (Mock)</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• MockWebSocket simulation</li>
                    <li>• Fake alert generation</li>
                    <li>• Local-only notifications</li>
                  </ul>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-600">🔧 Configuration</h4>
                  <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                    <div>Host: localhost:8080</div>
                    <div>Driver: reverb</div>
                    <div>Channels: private + public</div>
                    <div>Auth: role-based</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Testing Commands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <code className="text-sm bg-gray-100 p-2 rounded block">
                      php artisan websocket:test
                    </code>
                    <p className="text-xs text-gray-600 mt-1">Generate single test alert</p>
                  </div>
                  <div>
                    <code className="text-sm bg-gray-100 p-2 rounded block">
                      php artisan websocket:load-test 10
                    </code>
                    <p className="text-xs text-gray-600 mt-1">Generate multiple alerts for testing</p>
                  </div>
                  <div>
                    <code className="text-sm bg-gray-100 p-2 rounded block">
                      php artisan reverb:start
                    </code>
                    <p className="text-xs text-gray-600 mt-1">Start WebSocket server</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebSocketDemo() {
  return (
    <RealTimeAlertsProvider 
      enableToasts={true} 
      enableSound={false}
      maxAlerts={25}
      autoConnect={true}
    >
      <WebSocketDemoContent />
    </RealTimeAlertsProvider>
  );
}