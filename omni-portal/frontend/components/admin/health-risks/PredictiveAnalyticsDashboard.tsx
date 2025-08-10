'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, AlertTriangle, Brain, DollarSign, Users } from 'lucide-react';
import { healthIntelligenceApi, mlPredictionsApi } from '@/lib/api/admin/health-intelligence';
import type { PredictiveAnalytics } from '@/lib/api/admin/health-intelligence';

export default function PredictiveAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<PredictiveAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizonDays, setHorizonDays] = useState(30);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);

  useEffect(() => {
    loadAnalytics();
  }, [horizonDays, confidenceThreshold]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await healthIntelligenceApi.getPredictiveAnalytics({
        prediction_horizon_days: horizonDays,
        confidence_threshold: confidenceThreshold,
        include_interventions: true
      });
      setAnalytics(response.data);
    } catch (err) {
      setError('Failed to load predictive analytics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Predictive Analytics & ML Insights
          </h2>
          <p className="text-muted-foreground">AI-powered health risk predictions</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={horizonDays} 
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
          <Button onClick={loadAnalytics} variant="outline">Refresh</Button>
        </div>
      </div>

      {/* Cost Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Annual Cost Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(analytics.cost_analysis.current_annual_cost)}
            </div>
            <p className="text-xs text-muted-foreground">Current risk cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              Potential Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(analytics.cost_analysis.potential_savings)}
            </div>
            <p className="text-xs text-muted-foreground">With interventions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {analytics.cost_analysis.roi}:1
            </div>
            <p className="text-xs text-muted-foreground">
              Break-even: {analytics.cost_analysis.break_even_months} months
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Predictions Table */}
      <Card>
        <CardHeader>
          <CardTitle>High-Risk Predictions (ML Model v2.0)</CardTitle>
          <CardDescription>
            AI predictions with {(confidenceThreshold * 100).toFixed(0)}% confidence threshold
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="predictions">
            <TabsList>
              <TabsTrigger value="predictions">Risk Predictions</TabsTrigger>
              <TabsTrigger value="interventions">Recommended Actions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="predictions">
              <div className="space-y-2">
                {analytics.high_risk_predictions.map((pred, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Patient {pred.beneficiary_id}</p>
                        <p className="text-sm text-muted-foreground">
                          Current: <span className={`font-medium ${pred.current_risk === 'critical' ? 'text-red-600' : 'text-orange-600'}`}>
                            {pred.current_risk}
                          </span>
                          {' → '}
                          Predicted: <span className={`font-medium ${pred.predicted_risk === 'critical' ? 'text-red-600' : 'text-orange-600'}`}>
                            {pred.predicted_risk}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          {pred.trajectory === 'worsening' ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : pred.trajectory === 'improving' ? (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="h-4 w-4">→</span>
                          )}
                          <span className="text-sm font-medium">{pred.trajectory}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Confidence: {(pred.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    {pred.key_factors && pred.key_factors.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs font-medium mb-1">Key Risk Factors:</p>
                        <div className="flex flex-wrap gap-1">
                          {pred.key_factors.map((factor: any, i: number) => (
                            <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
                              {factor.category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="interventions">
              <div className="space-y-3">
                {analytics.recommended_interventions.map((intervention: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{intervention.intervention_type}</p>
                        <p className="text-sm text-muted-foreground">{intervention.category}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        intervention.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        intervention.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {intervention.priority}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Impact: {intervention.expected_impact}</span>
                      <span>Target: {intervention.target_population} members</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}