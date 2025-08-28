'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoleBasedAccess, { PERMISSIONS, usePermissions } from '@/components/admin/RoleBasedAccess';
import { 
  Download, 
  FileText, 
  Database, 
  Calendar, 
  Filter, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  X,
  Settings,
  Eye,
  RefreshCw
} from 'lucide-react';

// ===== TYPES =====
export interface ExportJob {
  id: string;
  name: string;
  description?: string;
  type: 'health_data' | 'user_data' | 'analytics' | 'audit_logs' | 'reports' | 'custom';
  format: 'csv' | 'json' | 'excel' | 'pdf' | 'xml';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: string;
  completedAt?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  recordCount?: number;
  createdBy: string;
  parameters: ExportParameters;
  error?: string;
  lgpdCompliant: boolean;
  encrypted: boolean;
  expiresAt: string;
}

export interface ExportParameters {
  dateRange: {
    start: string;
    end: string;
  };
  includeFields: string[];
  excludeFields: string[];
  filters: Record<string, unknown>;
  includeDeleted: boolean;
  anonymize: boolean;
  includePII: boolean; // Personally Identifiable Information
  maxRecords?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  type: ExportJob['type'];
  parameters: Partial<ExportParameters>;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  usageCount: number;
}

interface ExportFormData {
  name: string;
  description: string;
  type: ExportJob['type'];
  format: ExportJob['format'];
  parameters: ExportParameters;
  saveAsTemplate: boolean;
  templateName: string;
  scheduleExport: boolean;
  scheduleFrequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  scheduleCron?: string;
}

// ===== FIELD DEFINITIONS =====
const EXPORT_FIELDS = {
  health_data: [
    { id: 'user_id', label: 'User ID', sensitive: false },
    { id: 'questionnaire_id', label: 'Questionnaire ID', sensitive: false },
    { id: 'responses', label: 'Health Responses', sensitive: true },
    { id: 'risk_score', label: 'Risk Score', sensitive: false },
    { id: 'risk_level', label: 'Risk Level', sensitive: false },
    { id: 'completed_at', label: 'Completion Date', sensitive: false },
    { id: 'ai_analysis', label: 'AI Analysis', sensitive: true },
    { id: 'recommendations', label: 'Recommendations', sensitive: true }
  ],
  user_data: [
    { id: 'id', label: 'User ID', sensitive: false },
    { id: 'email', label: 'Email', sensitive: true },
    { id: 'name', label: 'Full Name', sensitive: true },
    { id: 'cpf', label: 'CPF', sensitive: true },
    { id: 'birth_date', label: 'Birth Date', sensitive: true },
    { id: 'phone', label: 'Phone Number', sensitive: true },
    { id: 'address', label: 'Address', sensitive: true },
    { id: 'created_at', label: 'Registration Date', sensitive: false },
    { id: 'last_login', label: 'Last Login', sensitive: false },
    { id: 'status', label: 'Account Status', sensitive: false }
  ],
  analytics: [
    { id: 'metric_name', label: 'Metric Name', sensitive: false },
    { id: 'metric_value', label: 'Value', sensitive: false },
    { id: 'timestamp', label: 'Timestamp', sensitive: false },
    { id: 'dimensions', label: 'Dimensions', sensitive: false },
    { id: 'aggregation', label: 'Aggregation Method', sensitive: false }
  ],
  audit_logs: [
    { id: 'timestamp', label: 'Timestamp', sensitive: false },
    { id: 'user_id', label: 'User ID', sensitive: true },
    { id: 'action', label: 'Action', sensitive: false },
    { id: 'resource', label: 'Resource', sensitive: false },
    { id: 'ip_address', label: 'IP Address', sensitive: true },
    { id: 'user_agent', label: 'User Agent', sensitive: false },
    { id: 'status', label: 'Status', sensitive: false }
  ],
  reports: [
    { id: 'report_id', label: 'Report ID', sensitive: false },
    { id: 'report_name', label: 'Report Name', sensitive: false },
    { id: 'generated_at', label: 'Generated At', sensitive: false },
    { id: 'data', label: 'Report Data', sensitive: false },
    { id: 'parameters', label: 'Parameters', sensitive: false }
  ],
  custom: []
};

// ===== MOCK DATA =====
function generateMockJobs(): ExportJob[] {
  const now = new Date();
  return [
    {
      id: 'job_1',
      name: 'Health Data Export - Q4 2024',
      description: 'Quarterly health questionnaire data for compliance reporting',
      type: 'health_data',
      format: 'excel',
      status: 'completed',
      progress: 100,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
      fileUrl: '/exports/health_data_q4_2024.xlsx',
      fileName: 'health_data_q4_2024.xlsx',
      fileSize: 2048576,
      recordCount: 15432,
      createdBy: 'admin@example.com',
      lgpdCompliant: true,
      encrypted: true,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      parameters: {
        dateRange: {
          start: '2024-10-01',
          end: '2024-12-31'
        },
        includeFields: ['user_id', 'responses', 'risk_score'],
        excludeFields: ['ai_analysis'],
        filters: { risk_level: ['high', 'medium'] },
        includeDeleted: false,
        anonymize: true,
        includePII: false
      }
    },
    {
      id: 'job_2',
      name: 'User Analytics Export',
      type: 'analytics',
      format: 'csv',
      status: 'processing',
      progress: 65,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      createdBy: 'analyst@example.com',
      lgpdCompliant: true,
      encrypted: true,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      parameters: {
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        },
        includeFields: ['metric_name', 'metric_value', 'timestamp'],
        excludeFields: [],
        filters: {},
        includeDeleted: false,
        anonymize: true,
        includePII: false
      }
    },
    {
      id: 'job_3',
      name: 'Security Audit Logs',
      type: 'audit_logs',
      format: 'json',
      status: 'failed',
      progress: 0,
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      createdBy: 'security@example.com',
      error: 'Insufficient permissions to access audit logs',
      lgpdCompliant: true,
      encrypted: true,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      parameters: {
        dateRange: {
          start: '2024-11-01',
          end: '2024-11-30'
        },
        includeFields: ['timestamp', 'action', 'resource'],
        excludeFields: ['ip_address', 'user_agent'],
        filters: { action: 'login_failed' },
        includeDeleted: false,
        anonymize: true,
        includePII: false
      }
    }
  ];
}

function generateMockTemplates(): ExportTemplate[] {
  return [
    {
      id: 'template_1',
      name: 'Health Data - Compliance Report',
      description: 'Standard health data export for compliance reporting',
      type: 'health_data',
      isDefault: true,
      createdBy: 'admin@example.com',
      createdAt: '2024-01-15T10:00:00Z',
      usageCount: 45,
      parameters: {
        includeFields: ['user_id', 'responses', 'risk_score', 'completed_at'],
        excludeFields: ['ai_analysis'],
        filters: {},
        includeDeleted: false,
        anonymize: true,
        includePII: false
      }
    },
    {
      id: 'template_2',
      name: 'User Statistics - Monthly',
      description: 'Monthly user analytics and engagement metrics',
      type: 'analytics',
      isDefault: false,
      createdBy: 'analyst@example.com',
      createdAt: '2024-02-01T14:30:00Z',
      usageCount: 12,
      parameters: {
        includeFields: ['metric_name', 'metric_value', 'timestamp'],
        excludeFields: [],
        filters: {},
        includeDeleted: false,
        anonymize: true,
        includePII: false
      }
    }
  ];
}

// ===== MAIN COMPONENT =====
export default function DataExportManager() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExportFormData>({
    name: '',
    description: '',
    type: 'health_data',
    format: 'csv',
    parameters: {
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      includeFields: [],
      excludeFields: [],
      filters: {},
      includeDeleted: false,
      anonymize: true,
      includePII: false
    },
    saveAsTemplate: false,
    templateName: '',
    scheduleExport: false,
    scheduleFrequency: 'monthly'
  });
  const { checkPermission, checkAccess } = usePermissions();

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Simulate API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
        setJobs(generateMockJobs());
        setTemplates(generateMockTemplates());
      } catch (error) {
        console.error('Failed to load export data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkPermission(PERMISSIONS.HEALTH_EXPORT)) {
      alert('You do not have permission to create data exports');
      return;
    }
    
    try {
      const newJob: ExportJob = {
        id: `job_${Date.now()}`,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        format: formData.format,
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
        createdBy: 'current_user@example.com',
        lgpdCompliant: true,
        encrypted: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        parameters: formData.parameters
      };
      
      setJobs(prev => [newJob, ...prev]);
      
      // Start processing simulation
      simulateJobProcessing(newJob.id);
      
      // Save as template if requested
      if (formData.saveAsTemplate && formData.templateName) {
        const newTemplate: ExportTemplate = {
          id: `template_${Date.now()}`,
          name: formData.templateName,
          description: formData.description,
          type: formData.type,
          isDefault: false,
          createdBy: 'current_user@example.com',
          createdAt: new Date().toISOString(),
          usageCount: 0,
          parameters: formData.parameters
        };
        setTemplates(prev => [...prev, newTemplate]);
      }
      
      setShowCreateForm(false);
      resetForm();
      
    } catch (error) {
      console.error('Failed to create export job:', error);
    }
  };

  // Simulate job processing
  const simulateJobProcessing = (jobId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? {
                ...job, 
                status: 'completed' as const,
                progress: 100,
                completedAt: new Date().toISOString(),
                fileUrl: `/exports/${job.name.toLowerCase().replace(/\s+/g, '_')}.${job.format}`,
                fileName: `${job.name.toLowerCase().replace(/\s+/g, '_')}.${job.format}`,
                fileSize: Math.floor(Math.random() * 10000000) + 100000,
                recordCount: Math.floor(Math.random() * 50000) + 1000
              }
            : job
        ));
      } else {
        setJobs(prev => prev.map(job => 
          job.id === jobId ? { ...job, progress: Math.floor(progress) } : job
        ));
      }
    }, 1000);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'health_data',
      format: 'csv',
      parameters: {
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        includeFields: [],
        excludeFields: [],
        filters: {},
        includeDeleted: false,
        anonymize: true,
        includePII: false
      },
      saveAsTemplate: false,
      templateName: '',
      scheduleExport: false,
      scheduleFrequency: 'monthly'
    });
    setSelectedTemplate(null);
  };

  // Load template
  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    setFormData(prev => ({
      ...prev,
      type: template.type,
      parameters: {
        ...prev.parameters,
        ...template.parameters
      }
    }));
    setSelectedTemplate(templateId);
  };

  // Handle field selection
  const handleFieldToggle = (fieldId: string, include: boolean) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        includeFields: include 
          ? [...prev.parameters.includeFields.filter(f => f !== fieldId), fieldId]
          : prev.parameters.includeFields.filter(f => f !== fieldId),
        excludeFields: include
          ? prev.parameters.excludeFields.filter(f => f !== fieldId)
          : [...prev.parameters.excludeFields.filter(f => f !== fieldId), fieldId]
      }
    }));
  };

  // Cancel job
  const cancelJob = (jobId: string) => {
    if (!checkPermission(PERMISSIONS.ADMIN_UPDATE)) return;
    
    setJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, status: 'cancelled' as const } : job
    ));
  };

  // Download file
  const downloadFile = (job: ExportJob) => {
    if (!job.fileUrl) return;
    
    // In a real implementation, this would trigger a secure download
    const link = document.createElement('a');
    link.href = job.fileUrl;
    link.download = job.fileName || 'export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get status color
  const getStatusColor = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'cancelled': return 'text-gray-600 bg-gray-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Loading export manager...</span>
      </div>
    );
  }

  return (
    <RoleBasedAccess
      requiredPermissions={[PERMISSIONS.HEALTH_READ, PERMISSIONS.REPORT_READ]}
      fallback={
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need health data and report permissions to access the data export manager.
          </AlertDescription>
        </Alert>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Export Manager</h1>
            <p className="text-gray-600">
              Create, manage, and download secure data exports with LGPD compliance
            </p>
          </div>
          <RoleBasedAccess requiredPermissions={[PERMISSIONS.HEALTH_EXPORT]}>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>New Export</span>
            </Button>
          </RoleBasedAccess>
        </div>

        {/* Create Export Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Export</CardTitle>
              <CardDescription>
                Configure a new data export with LGPD compliance and security features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="basic" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="fields">Fields</TabsTrigger>
                    <TabsTrigger value="filters">Filters</TabsTrigger>
                    <TabsTrigger value="options">Options</TabsTrigger>
                  </TabsList>

                  {/* Basic Information */}
                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Export Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter export name"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="type">Data Type</Label>
                        <Select 
                          value={formData.type} 
                          onValueChange={(value: ExportJob['type']) => 
                            setFormData(prev => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="health_data">Health Data</SelectItem>
                            <SelectItem value="user_data">User Data</SelectItem>
                            <SelectItem value="analytics">Analytics</SelectItem>
                            <SelectItem value="audit_logs">Audit Logs</SelectItem>
                            <SelectItem value="reports">Reports</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="format">Export Format</Label>
                        <Select 
                          value={formData.format} 
                          onValueChange={(value: ExportJob['format']) => 
                            setFormData(prev => ({ ...prev, format: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="pdf">PDF</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="template">Load Template</Label>
                        <Select 
                          value={selectedTemplate || ''} 
                          onValueChange={loadTemplate}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description for this export"
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={formData.parameters.dateRange.start}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            parameters: {
                              ...prev.parameters,
                              dateRange: {
                                ...prev.parameters.dateRange,
                                start: e.target.value
                              }
                            }
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={formData.parameters.dateRange.end}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            parameters: {
                              ...prev.parameters,
                              dateRange: {
                                ...prev.parameters.dateRange,
                                end: e.target.value
                              }
                            }
                          }))}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Fields Selection */}
                  <TabsContent value="fields" className="space-y-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Select Fields to Include</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {EXPORT_FIELDS[formData.type].map(field => {
                          const isIncluded = formData.parameters.includeFields.includes(field.id);
                          const isExcluded = formData.parameters.excludeFields.includes(field.id);
                          
                          return (
                            <div key={field.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={field.id}
                                checked={isIncluded}
                                onCheckedChange={(checked) => handleFieldToggle(field.id, Boolean(checked))}
                              />
                              <Label 
                                htmlFor={field.id} 
                                className={`flex items-center space-x-1 ${
                                  field.sensitive ? 'text-red-600' : 'text-gray-700'
                                }`}
                              >
                                <span>{field.label}</span>
                                {field.sensitive && <Shield className="h-3 w-3" />}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Filters */}
                  <TabsContent value="filters" className="space-y-4">
                    <Alert>
                      <Filter className="h-4 w-4" />
                      <AlertTitle>Advanced Filters</AlertTitle>
                      <AlertDescription>
                        Configure specific filters for your data export. Custom filter implementation would be added here.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  {/* Options */}
                  <TabsContent value="options" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="anonymize"
                          checked={formData.parameters.anonymize}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            parameters: {
                              ...prev.parameters,
                              anonymize: Boolean(checked)
                            }
                          }))}
                        />
                        <Label htmlFor="anonymize" className="flex items-center space-x-1">
                          <span>Anonymize sensitive data</span>
                          <Shield className="h-3 w-3 text-green-600" />
                        </Label>
                      </div>
                      
                      <RoleBasedAccess requiredPermissions={[PERMISSIONS.USER_READ]}>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="includePII"
                            checked={formData.parameters.includePII}
                            onCheckedChange={(checked) => setFormData(prev => ({
                              ...prev,
                              parameters: {
                                ...prev.parameters,
                                includePII: Boolean(checked)
                              }
                            }))}
                          />
                          <Label htmlFor="includePII" className="flex items-center space-x-1">
                            <span>Include PII (Personally Identifiable Information)</span>
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                          </Label>
                        </div>
                      </RoleBasedAccess>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeDeleted"
                          checked={formData.parameters.includeDeleted}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            parameters: {
                              ...prev.parameters,
                              includeDeleted: Boolean(checked)
                            }
                          }))}
                        />
                        <Label htmlFor="includeDeleted">Include deleted records</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="saveAsTemplate"
                          checked={formData.saveAsTemplate}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, saveAsTemplate: Boolean(checked) }))}
                        />
                        <Label htmlFor="saveAsTemplate">Save as template</Label>
                      </div>
                      
                      {formData.saveAsTemplate && (
                        <div>
                          <Label htmlFor="templateName">Template Name</Label>
                          <Input
                            id="templateName"
                            value={formData.templateName}
                            onChange={(e) => setFormData(prev => ({ ...prev, templateName: e.target.value }))}
                            placeholder="Enter template name"
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Create Export
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Export Jobs List */}
        <Card>
          <CardHeader>
            <CardTitle>Export Jobs</CardTitle>
            <CardDescription>
              Recent and ongoing data export jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.length > 0 ? (
                jobs.map(job => (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{job.name}</h4>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                          {job.lgpdCompliant && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              LGPD Compliant
                            </Badge>
                          )}
                          {job.encrypted && (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              Encrypted
                            </Badge>
                          )}
                        </div>
                        
                        {job.description && (
                          <p className="text-sm text-gray-600 mb-2">{job.description}</p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                          <div>
                            <span className="font-medium">Type:</span> {job.type.replace('_', ' ')}
                          </div>
                          <div>
                            <span className="font-medium">Format:</span> {job.format.toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium">Created:</span> {new Date(job.createdAt).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-medium">Records:</span> {job.recordCount?.toLocaleString() || 'N/A'}
                          </div>
                        </div>
                        
                        {job.status === 'processing' && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">Progress</span>
                              <span className="text-sm text-gray-500">{job.progress}%</span>
                            </div>
                            <Progress value={job.progress} className="w-full" />
                          </div>
                        )}
                        
                        {job.error && (
                          <Alert className="mt-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Export Failed</AlertTitle>
                            <AlertDescription>{job.error}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {job.status === 'completed' && job.fileUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(job)}
                            className="flex items-center space-x-1"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download</span>
                          </Button>
                        )}
                        
                        {job.status === 'processing' && checkPermission(PERMISSIONS.ADMIN_UPDATE) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelJob(job.id)}
                            className="flex items-center space-x-1 text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                            <span>Cancel</span>
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center space-x-1"
                        >
                          <Eye className="h-4 w-4" />
                          <span>Details</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Export Jobs</h3>
                  <p className="text-gray-600 mb-4">Get started by creating your first data export</p>
                  <RoleBasedAccess requiredPermissions={[PERMISSIONS.HEALTH_EXPORT]}>
                    <Button onClick={() => setShowCreateForm(true)}>
                      Create Export
                    </Button>
                  </RoleBasedAccess>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Export Templates</CardTitle>
            <CardDescription>
              Predefined export configurations for common use cases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(template => (
                <div key={template.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{template.name}</h4>
                    {template.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Used {template.usageCount} times</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        loadTemplate(template.id);
                        setShowCreateForm(true);
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleBasedAccess>
  );
}
