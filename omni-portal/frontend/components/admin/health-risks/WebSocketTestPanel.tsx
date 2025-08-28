'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, Zap, Info, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useRealTimeAlerts } from './RealTimeAlertsProvider';
import { testWebSocketConnection } from '@/lib/websocket';

interface WebSocketStatus {
  websocket?: {
    driver: string;
    enabled: boolean;
    reverb?: {
      host: string;
      port: number;
      app_key: string;
    };
  };
  channels?: {
    public: string[];
    private: string[];
  };
  events?: string[];
  server_time?: string;
}

export function WebSocketTestPanel() {
  const [status, setStatus] = useState<WebSocketStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadTestCount, setLoadTestCount] = useState(5);
  const [testResults, setTestResults] = useState<any>(null);
  const [connectionTest, setConnectionTest] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  
  const { isConnected, connectionStatus, alerts } = useRealTimeAlerts();

  // Fetch WebSocket status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/websocket/status`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch WebSocket status:', error);
    }
  };

  const runConnectionTest = async () => {
    setConnectionTest('testing');
    
    try {
      const isConnectable = await testWebSocketConnection();
      setConnectionTest(isConnectable ? 'success' : 'failed');
    } catch (error) {
      setConnectionTest('failed');
    }
  };

  const runSingleTest = async () => {
    setIsLoading(true);
    setTestResults(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/websocket/test`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      setTestResults({
        success: false,
        message: 'Failed to run test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runLoadTest = async () => {
    setIsLoading(true);
    setTestResults(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/websocket/load-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: loadTestCount }),
      });
      
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      setTestResults({
        success: false,
        message: 'Failed to run load test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected': return 'text-gray-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="h-4 w-4 text-green-600" />;
      case 'connecting': return <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />;
      default: return <WifiOff className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            WebSocket Test Panel
          </CardTitle>
          <CardDescription>
            Test and monitor the real-time WebSocket connection functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getConnectionStatusIcon()}
              <div>
                <p className="font-medium">Connection Status</p>
                <p className={`text-sm ${getConnectionStatusColor()}`}>
                  {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                  {isConnected && ' ✓'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Active Alerts</p>
              <p className="text-xl font-bold">{alerts.length}</p>
            </div>
          </div>

          <Separator />

          {/* WebSocket Server Status */}
          {status && (
            <div className="space-y-3">
              <h3 className="font-semibold">Server Configuration</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-600">Driver:</p>
                  <Badge variant={status.websocket?.enabled ? 'default' : 'secondary'}>
                    {status.websocket?.driver || 'Unknown'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-600">WebSocket Server:</p>
                  <p className="font-mono">
                    {status.websocket?.reverb?.host}:{status.websocket?.reverb?.port}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-600">App Key:</p>
                  <p className="font-mono text-xs">{status.websocket?.reverb?.app_key}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-600">Public Channels:</p>
                  <p className="text-xs">{status.channels?.public?.length || 0} channels</p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Test Actions */}
          <div className="space-y-4">
            <h3 className="font-semibold">Test Actions</h3>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={runConnectionTest}
                disabled={connectionTest === 'testing'}
                variant="outline"
                size="sm"
              >
                {connectionTest === 'testing' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>

              <Button 
                onClick={runSingleTest}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Send Test Alert
              </Button>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={loadTestCount}
                  onChange={(e) => setLoadTestCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
                  className="w-20"
                  min="1"
                  max="50"
                />
                <Button 
                  onClick={runLoadTest}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Load Test
                </Button>
              </div>

              <Button 
                onClick={fetchStatus}
                variant="ghost"
                size="sm"
              >
                <Info className="h-4 w-4 mr-2" />
                Refresh Status
              </Button>
            </div>
          </div>

          {/* Connection Test Results */}
          {connectionTest !== 'idle' && (
            <Alert className={connectionTest === 'success' ? 'border-green-200 bg-green-50' : connectionTest === 'failed' ? 'border-red-200 bg-red-50' : ''}>
              <div className="flex items-center gap-2">
                {connectionTest === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
                {connectionTest === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {connectionTest === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                <AlertDescription>
                  {connectionTest === 'testing' && 'Testing WebSocket connection...'}
                  {connectionTest === 'success' && 'WebSocket connection test successful!'}
                  {connectionTest === 'failed' && 'WebSocket connection test failed. Check server status.'}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Test Results */}
          {testResults && (
            <Alert className={testResults.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {testResults.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className="font-medium">
                    {testResults.message}
                  </AlertDescription>
                </div>
                {testResults.count && (
                  <p className="text-sm text-gray-700">
                    Broadcasted {testResults.count} alerts
                  </p>
                )}
                {testResults.error && (
                  <p className="text-sm text-red-600">
                    Error: {testResults.error}
                  </p>
                )}
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WebSocketTestPanel;