'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface HealthAlert {
  id: string;
  user_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  risk_factors: string[];
  recommendations: string[];
  status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
  user?: {
    name: string;
    email: string;
    cpf?: string;
  };
}

interface AlertDetailsCardProps {
  alert: HealthAlert;
  onStatusChange?: (alertId: string, newStatus: string) => Promise<void>;
  onCreateIntervention?: (alertId: string) => void;
  onAssign?: (alertId: string) => void;
  className?: string;
}

export default function AlertDetailsCard({
  alert,
  onStatusChange,
  onCreateIntervention,
  onAssign,
  className = '',
}: AlertDetailsCardProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (onStatusChange) {
      await onStatusChange(alert.id, newStatus);
    }
  };

  const renderAlertIcon = () => {
    switch (alert.severity) {
      case 'critical':
        return (
          <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'high':
        return (
          <svg className="w-8 h-8 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <Card className={`w-full max-w-4xl mx-auto ${className}`}>
      <CardHeader className="pb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {renderAlertIcon()}
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl font-semibold text-gray-900 mb-2">
                {alert.title}
              </CardTitle>
              <div className="flex items-center space-x-3 mb-3">
                <Badge className={getSeverityColor(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
                <Badge className={getStatusColor(alert.status)}>
                  {alert.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {alert.type}
                </Badge>
              </div>
              {alert.user && (
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Patient:</span> {alert.user.name} ({alert.user.email})
                  {alert.user.cpf && (
                    <span className="ml-2">CPF: {alert.user.cpf}</span>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500">
                <span className="font-medium">Created:</span> {formatDate(alert.created_at)} • 
                <span className="font-medium">Updated:</span> {formatDate(alert.updated_at)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {onCreateIntervention && (
              <Button
                size="sm"
                onClick={() => onCreateIntervention(alert.id)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create Intervention
              </Button>
            )}
            {onAssign && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAssign(alert.id)}
              >
                Assign
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Description */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Alert Description</h3>
          <p className="text-gray-700 leading-relaxed">
            {alert.description}
          </p>
        </div>

        {/* Risk Factors */}
        {alert.risk_factors && alert.risk_factors.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Risk Factors</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <ul className="list-disc list-inside space-y-1">
                {alert.risk_factors.map((factor, index) => (
                  <li key={index} className="text-red-800 text-sm">
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {alert.recommendations && alert.recommendations.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Recommendations</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <ul className="list-disc list-inside space-y-1">
                {alert.recommendations.map((rec, index) => (
                  <li key={index} className="text-green-800 text-sm">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Metadata */}
        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Additional Information</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(alert.metadata).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="font-medium text-gray-700 capitalize">
                      {key.replace('_', ' ')}:
                    </span>
                    <span className="ml-2 text-gray-600">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Status Actions */}
        {onStatusChange && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Update Status</h3>
            <div className="flex flex-wrap gap-2">
              {['acknowledged', 'in_progress', 'resolved', 'closed'].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={alert.status === status ? "default" : "outline"}
                  onClick={() => handleStatusChange(status)}
                  disabled={alert.status === status}
                >
                  Mark as {status.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
