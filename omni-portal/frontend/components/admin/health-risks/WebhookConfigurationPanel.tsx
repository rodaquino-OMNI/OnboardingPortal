'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoleBasedAccess, { PERMISSIONS, usePermissions } from '@/components/admin/RoleBasedAccess';
import { 
  Webhook, 
  Plus, 
  Settings, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Eye, 
  EyeOff,
  RefreshCw,
  Send,
  History,
  Clock,
  ExternalLink
} from 'lucide-react';

// ===== TYPES =====
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  description?: string;
  secret: string;
  isActive: boolean;
  events: WebhookEvent[];
  headers: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
  successCount: number;
  failureCount: number;
  isVerified: boolean;
}

export interface WebhookEvent {
  id: string;
  name: string;
  description: string;
  category: 'health' | 'user' | 'system' | 'compliance' | 'security';
  payload: Record<string, unknown>;
  enabled: boolean;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  eventType: string;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  httpStatus?: number;
  responseTime: number;
  timestamp: string;
  payload: Record<string, unknown>;
  response?: string;
  error?: string;
  attempts: number;
  nextRetry?: string;
}

export interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  events: string[];
  headers: Record<string, string>;
  isPopular: boolean;
}

// ===== AVAILABLE EVENTS =====
const WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    id: 'health.questionnaire.completed',
    name: 'Health Questionnaire Completed',
    description: 'Triggered when a user completes their health questionnaire',
    category: 'health',
    enabled: true,
    payload: {
      userId: 'string',
      questionnaireId: 'string',
      riskScore: 'number',
      riskLevel: 'string',
      completedAt: 'timestamp'
    }
  },
  {
    id: 'health.risk.high',
    name: 'High Risk Detected',
    description: 'Triggered when a high-risk health condition is identified',
    category: 'health',
    enabled: true,
    payload: {
      userId: 'string',
      riskFactors: 'array',
      riskScore: 'number',
      recommendations: 'array',
      timestamp: 'timestamp'
    }
  },
  {
    id: 'user.registered',
    name: 'User Registration',
    description: 'Triggered when a new user completes registration',
    category: 'user',
    enabled: true,
    payload: {
      userId: 'string',
      email: 'string',
      registrationStep: 'string',
      timestamp: 'timestamp'
    }
  },
  {
    id: 'user.document.uploaded',
    name: 'Document Uploaded',
    description: 'Triggered when a user uploads a document',
    category: 'user',
    enabled: true,
    payload: {
      userId: 'string',
      documentId: 'string',
      documentType: 'string',
      status: 'string',
      timestamp: 'timestamp'
    }
  },
  {
    id: 'system.maintenance.started',
    name: 'Maintenance Started',
    description: 'Triggered when system maintenance begins',
    category: 'system',
    enabled: true,
    payload: {
      maintenanceId: 'string',
      type: 'string',
      estimatedDuration: 'number',
      timestamp: 'timestamp'
    }
  },
  {
    id: 'security.suspicious.activity',
    name: 'Suspicious Activity',
    description: 'Triggered when suspicious user activity is detected',
    category: 'security',
    enabled: true,
    payload: {
      userId: 'string',
      activityType: 'string',
      riskLevel: 'string',
      ipAddress: 'string',
      timestamp: 'timestamp'
    }
  },
  {
    id: 'compliance.audit.required',
    name: 'Compliance Audit Required',
    description: 'Triggered when a compliance audit is required',
    category: 'compliance',
    enabled: true,
    payload: {
      auditType: 'string',
      dueDate: 'timestamp',
      priority: 'string',
      timestamp: 'timestamp'
    }
  }
];

// ===== MOCK DATA =====
function generateMockWebhooks(): WebhookEndpoint[] {
  const now = new Date();
  return [
    {
      id: 'webhook_1',
      name: 'Health Risk Notifications',
      url: 'https://api.healthsystem.com/webhooks/risk-alerts',
      description: 'Sends notifications when high-risk health conditions are detected',
      secret: 'whsec_1234567890abcdef',
      isActive: true,
      events: WEBHOOK_EVENTS.filter(e => e.category === 'health'),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'api_key_123'
      },
      timeout: 30,
      retryAttempts: 3,
      retryDelay: 300,
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastTriggered: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      successCount: 1247,
      failureCount: 23,
      isVerified: true
    },
    {
      id: 'webhook_2',
      name: 'User Activity Monitor',
      url: 'https://analytics.company.com/events',
      description: 'Tracks user registration and document upload events',
      secret: 'whsec_abcdef1234567890',
      isActive: true,
      events: WEBHOOK_EVENTS.filter(e => e.category === 'user'),
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15,
      retryAttempts: 2,
      retryDelay: 180,
      createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      lastTriggered: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      successCount: 2847,
      failureCount: 5,
      isVerified: true
    },
    {
      id: 'webhook_3',
      name: 'Security Alert System',
      url: 'https://security.alerts.com/api/webhooks',
      description: 'Security and compliance alert endpoint',
      secret: 'whsec_security123456',
      isActive: false,
      events: WEBHOOK_EVENTS.filter(e => ['security', 'compliance'].includes(e.category)),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      },
      timeout: 45,
      retryAttempts: 5,
      retryDelay: 600,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      successCount: 0,
      failureCount: 3,
      isVerified: false
    }
  ];
}

function generateMockLogs(): WebhookLog[] {
  const now = new Date();
  return [
    {
      id: 'log_1',
      webhookId: 'webhook_1',
      eventType: 'health.risk.high',
      status: 'success',
      httpStatus: 200,
      responseTime: 245,
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      payload: {
        userId: 'user_123',
        riskScore: 8.5,
        riskLevel: 'high',
        riskFactors: ['hypertension', 'diabetes']
      },
      response: '{"status": "received", "id": "alert_456"}',
      attempts: 1
    },
    {
      id: 'log_2',
      webhookId: 'webhook_2',
      eventType: 'user.registered',
      status: 'success',
      httpStatus: 201,
      responseTime: 156,
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      payload: {
        userId: 'user_456',
        email: 'user@example.com',
        registrationStep: 'completed'
      },
      response: '{"received": true}',
      attempts: 1
    },
    {
      id: 'log_3',
      webhookId: 'webhook_3',
      eventType: 'security.suspicious.activity',
      status: 'failed',
      httpStatus: 500,
      responseTime: 5000,
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      payload: {
        userId: 'user_789',
        activityType: 'multiple_failed_logins',
        riskLevel: 'medium'
      },
      error: 'Internal server error at endpoint',
      attempts: 3,
      nextRetry: new Date(now.getTime() + 10 * 60 * 1000).toISOString()
    }
  ];
}

const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: 'template_1',
    name: 'Slack Notifications',
    description: 'Basic Slack webhook integration',
    events: ['health.risk.high', 'system.maintenance.started'],
    headers: { 'Content-Type': 'application/json' },
    isPopular: true
  },
  {
    id: 'template_2',
    name: 'External API Integration',
    description: 'Generic API endpoint with authentication',
    events: ['user.registered', 'user.document.uploaded'],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    isPopular: true
  },
  {
    id: 'template_3',
    name: 'Compliance Monitoring',
    description: 'Dedicated compliance and audit tracking',
    events: ['compliance.audit.required', 'security.suspicious.activity'],
    headers: { 'Content-Type': 'application/json' },
    isPopular: false
  }
];

// ===== MAIN COMPONENT =====
export default function WebhookConfigurationPanel() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<WebhookEndpoint>>({
    name: '',
    url: '',
    description: '',
    secret: '',
    isActive: true,
    events: [],
    headers: { 'Content-Type': 'application/json' },
    timeout: 30,
    retryAttempts: 3,
    retryDelay: 300
  });
  
  const { checkPermission } = usePermissions();

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setWebhooks(generateMockWebhooks());
        setLogs(generateMockLogs());
      } catch (error) {
        console.error('Failed to load webhook data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Generate webhook secret
  const generateSecret = () => {
    const secret = `whsec_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setFormData(prev => ({ ...prev, secret }));
  };

  // Load template
  const loadTemplate = (templateId: string) => {
    const template = WEBHOOK_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setFormData(prev => ({
      ...prev,
      events: WEBHOOK_EVENTS.filter(e => template.events.includes(e.id)),
      headers: template.headers
    }));
    setSelectedTemplate(templateId);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkPermission(PERMISSIONS.SYSTEM_SETTINGS)) {
      alert('You do not have permission to manage webhooks');
      return;
    }
    
    try {
      const webhookData: WebhookEndpoint = {
        id: editingWebhook?.id || `webhook_${Date.now()}`,
        name: formData.name!,
        url: formData.url!,
        description: formData.description,
        secret: formData.secret!,
        isActive: formData.isActive!,
        events: formData.events!,
        headers: formData.headers!,
        timeout: formData.timeout!,
        retryAttempts: formData.retryAttempts!,
        retryDelay: formData.retryDelay!,
        createdAt: editingWebhook?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        successCount: editingWebhook?.successCount || 0,
        failureCount: editingWebhook?.failureCount || 0,
        isVerified: false
      };
      
      if (editingWebhook) {
        setWebhooks(prev => prev.map(w => w.id === editingWebhook.id ? webhookData : w));
      } else {
        setWebhooks(prev => [webhookData, ...prev]);
      }
      
      resetForm();
      
    } catch (error) {
      console.error('Failed to save webhook:', error);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      description: '',
      secret: '',
      isActive: true,
      events: [],
      headers: { 'Content-Type': 'application/json' },
      timeout: 30,
      retryAttempts: 3,
      retryDelay: 300
    });
    setShowCreateForm(false);
    setEditingWebhook(null);
    setSelectedTemplate(null);
  };

  // Edit webhook
  const editWebhook = (webhook: WebhookEndpoint) => {
    setFormData(webhook);
    setEditingWebhook(webhook);
    setShowCreateForm(true);
  };

  // Delete webhook
  const deleteWebhook = (webhookId: string) => {
    if (!checkPermission(PERMISSIONS.ADMIN_DELETE)) return;
    
    if (confirm('Are you sure you want to delete this webhook?')) {
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
    }
  };

  // Toggle webhook active state
  const toggleWebhook = (webhookId: string, isActive: boolean) => {
    if (!checkPermission(PERMISSIONS.SYSTEM_SETTINGS)) return;
    
    setWebhooks(prev => prev.map(w => 
      w.id === webhookId ? { ...w, isActive } : w
    ));
  };

  // Test webhook
  const testWebhook = async (webhookId: string) => {
    if (!checkPermission(PERMISSIONS.SYSTEM_SETTINGS)) return;
    
    setTestingWebhook(webhookId);
    
    try {
      // Simulate webhook test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const webhook = webhooks.find(w => w.id === webhookId);
      if (webhook) {
        const testLog: WebhookLog = {
          id: `log_test_${Date.now()}`,
          webhookId,
          eventType: 'webhook.test',
          status: Math.random() > 0.2 ? 'success' : 'failed',
          httpStatus: Math.random() > 0.2 ? 200 : 500,
          responseTime: Math.floor(Math.random() * 1000) + 100,
          timestamp: new Date().toISOString(),
          payload: { test: true, timestamp: new Date().toISOString() },
          response: Math.random() > 0.2 ? '{"status": "ok"}' : undefined,
          error: Math.random() > 0.2 ? undefined : 'Connection timeout',
          attempts: 1
        };
        
        setLogs(prev => [testLog, ...prev]);
      }
    } finally {
      setTestingWebhook(null);
    }
  };

  // Toggle secret visibility
  const toggleSecretVisibility = (webhookId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [webhookId]: !prev[webhookId]
    }));
  };

  // Get status color
  const getStatusColor = (status: WebhookLog['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'retrying': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Loading webhook configuration...</span>
      </div>
    );
  }

  return (
    <RoleBasedAccess
      requiredPermissions={[PERMISSIONS.SYSTEM_SETTINGS]}
      fallback={
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need system settings permissions to manage webhook configurations.
          </AlertDescription>
        </Alert>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Webhook Configuration</h1>
            <p className="text-gray-600">
              Configure and manage webhook endpoints for real-time event notifications
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Webhook</span>
          </Button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingWebhook ? 'Edit Webhook' : 'Create New Webhook'}
              </CardTitle>
              <CardDescription>
                Configure a webhook endpoint to receive real-time event notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="basic" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>

                  {/* Basic Information */}
                  <TabsContent value="basic" className="space-y-4">
                    <div>
                      <Label htmlFor="template">Use Template (Optional)</Label>
                      <Select 
                        value={selectedTemplate || ''} 
                        onValueChange={loadTemplate}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEBHOOK_TEMPLATES.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center space-x-2">
                                <span>{template.name}</span>
                                {template.isPopular && (
                                  <Badge variant="secondary" className="text-xs">Popular</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Webhook Name</Label>
                        <Input
                          id="name"
                          value={formData.name || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter webhook name"
                          required
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isActive"
                          checked={formData.isActive}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                        />
                        <Label htmlFor="isActive">Active</Label>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="url">Endpoint URL</Label>
                      <Input
                        id="url"
                        type="url"
                        value={formData.url || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://your-endpoint.com/webhook"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description of this webhook"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="secret">Webhook Secret</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="secret"
                          value={formData.secret || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                          placeholder="Webhook signing secret"
                          required
                        />
                        <Button type="button" variant="outline" onClick={generateSecret}>
                          Generate
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Used to verify webhook authenticity. Keep this secret secure.
                      </p>
                    </div>
                  </TabsContent>

                  {/* Events */}
                  <TabsContent value="events" className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-3">Select Events to Subscribe To</h4>
                      <div className="space-y-4">
                        {Object.entries(
                          WEBHOOK_EVENTS.reduce((groups, event) => {
                            if (!groups[event.category]) {
                              groups[event.category] = [];
                            }
                            groups[event.category].push(event);
                            return groups;
                          }, {} as Record<string, WebhookEvent[]>)
                        ).map(([category, events]) => (
                          <div key={category}>
                            <h5 className="font-medium text-sm mb-2 capitalize">
                              {category} Events
                            </h5>
                            <div className="space-y-2 pl-4">
                              {events.map(event => {
                                const isSelected = formData.events?.some(e => e.id === event.id);
                                return (
                                  <div key={event.id} className="flex items-start space-x-3">
                                    <input
                                      type="checkbox"
                                      id={event.id}
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setFormData(prev => ({
                                          ...prev,
                                          events: checked
                                            ? [...(prev.events || []), event]
                                            : (prev.events || []).filter(ev => ev.id !== event.id)
                                        }));
                                      }}
                                      className="mt-1"
                                    />
                                    <div>
                                      <Label htmlFor={event.id} className="font-medium">
                                        {event.name}
                                      </Label>
                                      <p className="text-sm text-gray-600">
                                        {event.description}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Headers */}
                  <TabsContent value="headers" className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-3">HTTP Headers</h4>
                      <div className="space-y-2">
                        {Object.entries(formData.headers || {}).map(([key, value], index) => (
                          <div key={index} className="flex space-x-2">
                            <Input
                              value={key}
                              onChange={(e) => {
                                const newKey = e.target.value;
                                setFormData(prev => {
                                  const newHeaders = { ...prev.headers };
                                  delete newHeaders[key];
                                  newHeaders[newKey] = value;
                                  return { ...prev, headers: newHeaders };
                                });
                              }}
                              placeholder="Header name"
                            />
                            <Input
                              value={value}
                              onChange={(e) => {
                                setFormData(prev => ({
                                  ...prev,
                                  headers: {
                                    ...prev.headers,
                                    [key]: e.target.value
                                  }
                                }));
                              }}
                              placeholder="Header value"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFormData(prev => {
                                  const newHeaders = { ...prev.headers };
                                  delete newHeaders[key];
                                  return { ...prev, headers: newHeaders };
                                });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              headers: {
                                ...prev.headers,
                                '': ''
                              }
                            }));
                          }}
                        >
                          Add Header
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Settings */}
                  <TabsContent value="settings" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="timeout">Timeout (seconds)</Label>
                        <Input
                          id="timeout"
                          type="number"
                          value={formData.timeout || 30}
                          onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                          min="1"
                          max="300"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="retryAttempts">Retry Attempts</Label>
                        <Input
                          id="retryAttempts"
                          type="number"
                          value={formData.retryAttempts || 3}
                          onChange={(e) => setFormData(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) }))}
                          min="0"
                          max="10"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="retryDelay">Retry Delay (seconds)</Label>
                        <Input
                          id="retryDelay"
                          type="number"
                          value={formData.retryDelay || 300}
                          onChange={(e) => setFormData(prev => ({ ...prev, retryDelay: parseInt(e.target.value) }))}
                          min="1"
                          max="3600"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingWebhook ? 'Update' : 'Create'} Webhook
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Webhook List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Configured Webhooks</CardTitle>
              <CardDescription>
                Manage your webhook endpoints and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {webhooks.length > 0 ? (
                  webhooks.map(webhook => (
                    <div key={webhook.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium">{webhook.name}</h4>
                            <Badge className={webhook.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}>
                              {webhook.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {webhook.isVerified && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          {webhook.description && (
                            <p className="text-sm text-gray-600">{webhook.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Switch
                            checked={webhook.isActive}
                            onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                            disabled={!checkPermission(PERMISSIONS.SYSTEM_SETTINGS)}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">URL:</span>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">
                            {webhook.url}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(webhook.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Secret:</span>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">
                            {showSecrets[webhook.id] ? webhook.secret : '••••••••••••••••'}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSecretVisibility(webhook.id)}
                          >
                            {showSecrets[webhook.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between text-gray-500">
                          <span>Events: {webhook.events.length}</span>
                          <span>Success: {webhook.successCount} | Failed: {webhook.failureCount}</span>
                        </div>
                        
                        {webhook.lastTriggered && (
                          <div className="flex items-center space-x-1 text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>Last: {new Date(webhook.lastTriggered).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingWebhook === webhook.id || !webhook.isActive}
                        >
                          {testingWebhook === webhook.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          <span className="ml-1">Test</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editWebhook(webhook)}
                        >
                          <Settings className="h-3 w-3" />
                          <span className="ml-1">Edit</span>
                        </Button>
                        {checkPermission(PERMISSIONS.ADMIN_DELETE) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteWebhook(webhook.id)}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <X className="h-3 w-3" />
                            <span className="ml-1">Delete</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Webhook className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Webhooks Configured</h3>
                    <p className="text-gray-600 mb-4">Get started by creating your first webhook endpoint</p>
                    <Button onClick={() => setShowCreateForm(true)}>
                      Create Webhook
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Webhook Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Recent webhook deliveries and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs.length > 0 ? (
                  logs.slice(0, 10).map(log => {
                    const webhook = webhooks.find(w => w.id === log.webhookId);
                    return (
                      <div key={log.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(log.status)}>
                                {log.status}
                              </Badge>
                              <span className="font-medium text-sm">{log.eventType}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {webhook?.name || 'Unknown Webhook'} • {new Date(log.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            {log.httpStatus && <div>HTTP {log.httpStatus}</div>}
                            <div>{log.responseTime}ms</div>
                          </div>
                        </div>
                        
                        {log.error && (
                          <Alert className="mt-2">
                            <AlertTriangle className="h-3 w-3" />
                            <AlertDescription className="text-xs">
                              {log.error}
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {log.nextRetry && (
                          <div className="text-xs text-yellow-600 mt-1">
                            Next retry: {new Date(log.nextRetry).toLocaleString()}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <History className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No webhook activity yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleBasedAccess>
  );
}
