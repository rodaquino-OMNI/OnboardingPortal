'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending' | 'cancelled';
  assignedTo?: string;
  metadata?: Record<string, any>;
}

interface WorkflowTimelineProps {
  alertId: string;
  events: TimelineEvent[];
  className?: string;
}

export default function WorkflowTimeline({ alertId, events, className = '' }: WorkflowTimelineProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in-progress':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'; // green
      case 'in-progress':
        return 'secondary'; // blue
      case 'pending':
        return 'outline'; // yellow
      case 'cancelled':
        return 'destructive'; // red
      default:
        return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'alert-created':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'risk-assessment':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'intervention-planned':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        );
      case 'intervention-completed':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'follow-up':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (!events || events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Workflow Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>No workflow events available for this alert.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Workflow Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="relative flex items-start space-x-3">
              {/* Timeline line */}
              {index < events.length - 1 && (
                <div className="absolute left-6 top-8 h-full w-0.5 bg-gray-200" />
              )}
              
              {/* Status indicator */}
              <div className={`
                relative flex items-center justify-center w-12 h-12 rounded-full 
                ${getStatusColor(event.status)} text-white
              `}>
                {getEventIcon(event.type)}
              </div>
              
              {/* Event content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    {event.title}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusBadgeVariant(event.status)}>
                      {event.status.replace('-', ' ')}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">
                  {event.description}
                </p>
                
                {event.assignedTo && (
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">Assigned to:</span> {event.assignedTo}
                  </div>
                )}
                
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-gray-700 mb-1">Additional Details:</div>
                    {Object.entries(event.metadata).map(([key, value]) => (
                      <div key={key} className="text-gray-600">
                        <span className="capitalize">{key.replace('_', ' ')}:</span> {String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
