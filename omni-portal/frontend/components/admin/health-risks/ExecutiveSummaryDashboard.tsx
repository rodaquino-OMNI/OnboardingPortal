'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Target,
  FileText,
  Download,
  Calendar
} from 'lucide-react';
import { healthIntelligenceApi } from '@/lib/api/admin/health-intelligence';
import type { ExecutiveSummary } from '@/lib/api/admin/health-intelligence';

export default function ExecutiveSummaryDashboard() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [period]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const response = await healthIntelligenceApi.getExecutiveSummary({
        period,
        include_cost_analysis: true,
        include_roi_metrics: true,
        format: 'json'
      });
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load executive summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdfReport = async () => {
    try {
      setDownloadingPdf(true);
      const response = await healthIntelligenceApi.getExecutiveSummary({
        period,
        include_cost_analysis: true,
        include_roi_metrics: true,
        format: 'pdf'
      });
      
      // Handle PDF download URL
      if (response.data?.download_url) {
        window.open(response.data.download_url, '_blank');
      }
    } catch (error) {
      console.error('Failed to download PDF:', error);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Executive Health Summary</h2>
          <p className="text-muted-foreground">Strategic overview and financial impact analysis</p>
        </div>
        <div className="flex gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button 
            onClick={downloadPdfReport} 
            disabled={downloadingPdf}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {downloadingPdf ? 'Generating...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Population Assessed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {summary.executive_overview.total_population_assessed.toLocaleString()}
              </span>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Risk Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-600">
                {summary.executive_overview.high_risk_percentage.toFixed(1)}%
              </span>
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.financial_impact.projected_savings)}
              </span>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Return on Investment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">
                {summary.financial_impact.roi}
              </span>
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payback: {summary.financial_impact.payback_period}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial Impact</TabsTrigger>
          <TabsTrigger value="metrics">Success Metrics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {summary.executive_overview.key_achievements.map((achievement, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                      <span className="text-sm">{achievement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Areas of Concern</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {summary.executive_overview.areas_of_concern.map((concern, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="h-2 w-2 rounded-full bg-orange-500 mt-1.5" />
                      <span className="text-sm">{concern}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Impact Analysis</CardTitle>
              <CardDescription>
                Comprehensive cost-benefit analysis for the {period} period
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Risk Cost</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary.financial_impact.current_risk_cost)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Projected Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.financial_impact.projected_savings)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Cost Reduction Progress</span>
                  <span className="font-medium">25%</span>
                </div>
                <Progress value={25} className="h-2" />
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">ROI Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Direct Medical Savings</span>
                    <span className="font-medium">
                      {formatCurrency(summary.financial_impact.projected_savings * 0.6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Indirect Savings</span>
                    <span className="font-medium">
                      {formatCurrency(summary.financial_impact.projected_savings * 0.3)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Productivity Gains</span>
                    <span className="font-medium">
                      {formatCurrency(summary.financial_impact.projected_savings * 0.1)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Interventions Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {summary.success_metrics.interventions_completed}
                </div>
                <Progress value={75} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">75% of target</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Risk Reduction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {summary.success_metrics.risk_reduction_achieved.toFixed(1)}%
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">vs. previous period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Member Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {summary.success_metrics.member_engagement_rate.toFixed(1)}%
                </div>
                <Progress value={summary.success_metrics.member_engagement_rate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">Active participation</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strategic Recommendations</CardTitle>
              <CardDescription>
                Priority actions for the next {period} period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.strategic_recommendations.map((recommendation, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-muted rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold">{idx + 1}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}