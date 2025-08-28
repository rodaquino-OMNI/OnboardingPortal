import React from 'react';
import { RealTimeAlertsProvider } from '@/components/admin/health-risks/RealTimeAlertsProvider';
import WebSocketTestPanel from '@/components/admin/health-risks/WebSocketTestPanel';
import { AlertNotification } from '@/components/admin/health-risks/RealTimeAlertsProvider';
import { useRealTimeAlerts } from '@/components/admin/health-risks/RealTimeAlertsProvider';

function WebSocketTestContent() {
  const { alerts, acknowledgeAlert, resolveAlert, dismissAlert, connectionStatus, isConnected } = useRealTimeAlerts();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            WebSocket Real-Time Alerts Test
          </h1>
          <p className="text-gray-600">
            Test the real-time WebSocket functionality and monitor incoming alerts.
            Connection Status: <span className={`font-semibold ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}>
              {connectionStatus.toUpperCase()}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Panel */}
          <div>
            <WebSocketTestPanel />
          </div>

          {/* Live Alerts Feed */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Live Alerts Feed ({alerts.length})
            </h2>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No alerts yet. Use the test panel to generate alerts.</p>
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
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Testing Instructions
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Verify the connection status shows "CONNECTED"</li>
            <li>Click "Test Connection" to verify WebSocket connectivity</li>
            <li>Click "Send Test Alert" to broadcast a single test alert</li>
            <li>Use "Load Test" to send multiple alerts simultaneously</li>
            <li>Check that alerts appear in real-time in the right panel</li>
            <li>Test acknowledge, resolve, and dismiss functionality</li>
          </ol>
        </div>

        {/* WebSocket Details */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            WebSocket Configuration
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Host:</span> {process.env.NEXT_PUBLIC_PUSHER_HOST}
            </div>
            <div>
              <span className="font-medium">Port:</span> {process.env.NEXT_PUBLIC_PUSHER_PORT}
            </div>
            <div>
              <span className="font-medium">Scheme:</span> {process.env.NEXT_PUBLIC_PUSHER_SCHEME}
            </div>
            <div>
              <span className="font-medium">App Key:</span> {process.env.NEXT_PUBLIC_PUSHER_APP_KEY}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebSocketTestPage() {
  return (
    <RealTimeAlertsProvider 
      enableToasts={true} 
      enableSound={false}
      maxAlerts={50}
      autoConnect={true}
    >
      <WebSocketTestContent />
    </RealTimeAlertsProvider>
  );
}