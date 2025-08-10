'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Webhook, Shield, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { healthIntelligenceApi } from '@/lib/api/admin/health-intelligence';

const WEBHOOK_EVENTS = [
  { id: 'suicide_risk', label: 'Suicide Risk Alert', critical: true },
  { id: 'violence_exposure', label: 'Violence Exposure', critical: true },
  { id: 'critical_allergy', label: 'Critical Allergy Warning', critical: true },
  { id: 'emergency_mental_health', label: 'Emergency Mental Health', critical: true },
  { id: 'cardiac_emergency', label: 'Cardiac Emergency', critical: true }
];

export default function WebhookConfigurationPanel() {
  const [toastMessage, setToastMessage] = useState<{title: string; description: string; variant?: string} | null>(null);
  const toast = (msg: {title: string; description: string; variant?: string}) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  const [endpoint, setEndpoint] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [backoffSeconds, setBackoffSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [webhookId, setWebhookId] = useState<string | null>(null);

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecret(result);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast({
      title: 'Secret copied',
      description: 'Webhook secret has been copied to clipboard'
    });
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!endpoint || selectedEvents.length === 0 || !secret) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await healthIntelligenceApi.registerWebhook({
        endpoint,
        events: selectedEvents,
        secret,
        retry_policy: {
          max_attempts: maxAttempts,
          backoff_seconds: backoffSeconds
        }
      });

      if (response.data) {
        setWebhookId(response.data.webhook_id);
        setTestResult(response.data.test_result);
        toast({
          title: 'Webhook Registered',
          description: `Webhook ID: ${response.data.webhook_id}`,
        });
      }
    } catch (error) {
      console.error('Failed to register webhook:', error);
      toast({
        title: 'Registration Failed',
        description: 'Could not register webhook. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookId) {
      toast({
        title: 'No webhook registered',
        description: 'Please register a webhook first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      // Trigger a test notification
      await healthIntelligenceApi.notifyAlert({
        alert_id: 'test_alert_001',
        notification_type: 'immediate',
        webhook_id: webhookId
      });
      
      toast({
        title: 'Test notification sent',
        description: 'Check your webhook endpoint for the test payload'
      });
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: 'Test failed',
        description: 'Could not send test notification',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <Alert variant={toastMessage.variant as any}>
          <AlertDescription>
            <strong>{toastMessage.title}</strong>
            <p>{toastMessage.description}</p>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Configuration for Critical Alerts
          </CardTitle>
          <CardDescription>
            Configure real-time notifications for critical health events via webhooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Endpoint URL */}
            <div className="space-y-2">
              <Label htmlFor="endpoint">Webhook Endpoint URL *</Label>
              <Input
                id="endpoint"
                type="url"
                placeholder="https://your-health-plan.com/webhooks/alerts"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                HTTPS endpoint that will receive POST requests with alert payloads
              </p>
            </div>

            {/* Event Selection */}
            <div className="space-y-2">
              <Label>Select Events to Monitor *</Label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map(event => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={event.id}
                      checked={selectedEvents.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label 
                      htmlFor={event.id} 
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      {event.label}
                      {event.critical && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                          Critical
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Secret Key */}
            <div className="space-y-2">
              <Label htmlFor="secret">Webhook Secret (for HMAC verification) *</Label>
              <div className="flex gap-2">
                <Input
                  id="secret"
                  type="text"
                  placeholder="Enter or generate a secret key"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required
                />
                <Button type="button" variant="outline" onClick={generateSecret}>
                  Generate
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={copySecret}
                  disabled={!secret}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Store this secret securely. It will be used to sign webhook payloads.
              </p>
            </div>

            {/* Retry Policy */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxAttempts">Max Retry Attempts</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  min="1"
                  max="5"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backoffSeconds">Backoff Seconds</Label>
                <Input
                  id="backoffSeconds"
                  type="number"
                  min="1"
                  max="300"
                  value={backoffSeconds}
                  onChange={(e) => setBackoffSeconds(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Register Webhook'}
              </Button>
              {webhookId && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={testWebhook}
                  disabled={loading}
                >
                  Send Test Notification
                </Button>
              )}
            </div>
          </form>

          {/* Test Result */}
          {testResult && (
            <Alert className="mt-4" variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Endpoint Test Result:</p>
                  <p>Status: {testResult.success ? 'Success' : 'Failed'}</p>
                  {testResult.status_code && <p>HTTP Status: {testResult.status_code}</p>}
                  {testResult.response_time_ms && (
                    <p>Response Time: {testResult.response_time_ms}ms</p>
                  )}
                  {testResult.error && <p>Error: {testResult.error}</p>}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Webhook ID Display */}
          {webhookId && (
            <Alert className="mt-4">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Webhook Registered Successfully</p>
                  <p className="font-mono text-sm">ID: {webhookId}</p>
                  <p className="text-xs text-muted-foreground">
                    Store this ID for future reference and API calls
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Payload Format</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
{`{
  "event_type": "suicide_risk",
  "notification_id": "notif_abc123",
  "timestamp": "2025-01-07T10:30:00Z",
  "alert": {
    "id": 123,
    "category": "mental_health",
    "priority": "emergency",
    "risk_score": 95,
    "title": "High Suicide Risk Detected",
    "description": "PHQ-9 Q9 indicates active ideation"
  },
  "beneficiary": {
    "id": "hashed_id_xyz",
    "age_group": "30-39",
    "risk_profile": {...}
  },
  "clinical_recommendations": [...],
  "urgency": "immediate"
}`}
          </pre>
          <p className="text-sm text-muted-foreground mt-2">
            All payloads are signed with HMAC-SHA256 using your secret key.
            Verify the signature in the X-Webhook-Signature header.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}