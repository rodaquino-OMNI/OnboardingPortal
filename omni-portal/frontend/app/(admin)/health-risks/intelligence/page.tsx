'use client';

import React from 'react';
import PredictiveAnalyticsDashboard from '@/components/admin/health-risks/PredictiveAnalyticsDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WebhookConfigurationPanel from '@/components/admin/health-risks/WebhookConfigurationPanel';
import ExecutiveSummaryDashboard from '@/components/admin/health-risks/ExecutiveSummaryDashboard';

export default function HealthIntelligencePage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Health Intelligence & ML Analytics</h1>
        <p className="text-muted-foreground">
          Advanced predictive analytics, external API integration, and executive insights
        </p>
      </div>

      <Tabs defaultValue="predictive" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="predictive">Predictive Analytics</TabsTrigger>
          <TabsTrigger value="executive">Executive Summary</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="predictive">
          <PredictiveAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="executive">
          <ExecutiveSummaryDashboard />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhookConfigurationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}