'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PredictiveModel {
  id: string;
  name: string;
  type: string;
  accuracy: number;
  lastTrained: string;
  status: 'active' | 'training' | 'inactive';
  predictions: number;
}

interface RiskPrediction {
  userId: string;
  userName: string;
  riskScore: number;
  riskCategory: 'low' | 'medium' | 'high' | 'critical';
  primaryRiskFactors: string[];
  predictedOutcomes: string[];
  confidence: number;
  recommendedActions: string[];
  timeframe: string;
}

interface PredictiveAnalyticsDashboardProps {
  className?: string;
}

export default function PredictiveAnalyticsDashboard({ className = '' }: PredictiveAnalyticsDashboardProps) {
  const [models, setModels] = useState<PredictiveModel[]>([]);
  const [predictions, setPredictions] = useState<RiskPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Mock data for demonstration
    setModels([
      {
        id: '1',
        name: 'Cardiovascular Risk Model',
        type: 'Neural Network',
        accuracy: 0.87,
        lastTrained: '2024-01-15',
        status: 'active',
        predictions: 1247,
      },
      {
        id: '2',
        name: 'Diabetes Risk Predictor',
        type: 'Random Forest',
        accuracy: 0.82,
        lastTrained: '2024-01-10',
        status: 'active',
        predictions: 892,
      },
      {
        id: '3',
        name: 'Mental Health Risk Assessment',
        type: 'SVM',
        accuracy: 0.79,
        lastTrained: '2024-01-12',
        status: 'training',
        predictions: 634,
      },
    ]);

    setPredictions([
      {
        userId: '1',
        userName: 'João Silva',
        riskScore: 0.78,
        riskCategory: 'high',
        primaryRiskFactors: ['Hypertension', 'Family History', 'Sedentary Lifestyle'],
        predictedOutcomes: ['Cardiovascular Event', 'Type 2 Diabetes'],
        confidence: 0.85,
        recommendedActions: ['Cardiology Consultation', 'Lifestyle Modification', 'Regular Monitoring'],
        timeframe: '6-12 months',
      },
      {
        userId: '2',
        userName: 'Maria Santos',
        riskScore: 0.65,
        riskCategory: 'medium',
        primaryRiskFactors: ['BMI > 30', 'Age > 50', 'Prediabetes'],
        predictedOutcomes: ['Type 2 Diabetes', 'Metabolic Syndrome'],
        confidence: 0.72,
        recommendedActions: ['Nutritional Counseling', 'Physical Activity Program'],
        timeframe: '12-18 months',
      },
      {
        userId: '3',
        userName: 'Pedro Oliveira',
        riskScore: 0.82,
        riskCategory: 'critical',
        primaryRiskFactors: ['Multiple Risk Factors', 'Previous Events', 'Non-compliance'],
        predictedOutcomes: ['Acute Cardiovascular Event', 'Hospitalization'],
        confidence: 0.91,
        recommendedActions: ['Immediate Medical Review', 'Care Coordination', 'Medication Adjustment'],
        timeframe: '1-6 months',
      },
    ]);

    setLoading(false);
  }, []);

  const getRiskCategoryColor = (category: string) => {
    switch (category) {
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

  const getModelStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'training':
        return 'bg-blue-100 text-blue-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading predictive analytics...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Predictive Analytics Dashboard</h1>
        <Button>Train New Model</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-blue-600">{models.length}</div>
                <p className="text-sm text-gray-600">Active Models</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-green-600">
                  {predictions.length}
                </div>
                <p className="text-sm text-gray-600">Risk Predictions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-orange-600">
                  {predictions.filter(p => p.riskCategory === 'high' || p.riskCategory === 'critical').length}
                </div>
                <p className="text-sm text-gray-600">High Risk Cases</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(models.reduce((acc, m) => acc + m.accuracy, 0) / models.length * 100)}%
                </div>
                <p className="text-sm text-gray-600">Avg. Accuracy</p>
              </CardContent>
            </Card>
          </div>

          {/* Risk Distribution Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-2xl mb-2">📊</div>
                  <p>Risk distribution chart would be displayed here</p>
                  <p className="text-sm mt-1">(Integration with charting library needed)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Machine Learning Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {models.map((model) => (
                  <div key={model.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-lg">{model.name}</h3>
                        <Badge className={getModelStatusColor(model.status)}>
                          {model.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">View Details</Button>
                        <Button size="sm">Retrain</Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Type:</span>
                        <p className="text-gray-600">{model.type}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Accuracy:</span>
                        <p className="text-gray-600">{Math.round(model.accuracy * 100)}%</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Predictions:</span>
                        <p className="text-gray-600">{model.predictions.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Last Trained:</span>
                        <p className="text-gray-600">{new Date(model.lastTrained).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>High-Risk Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictions.map((prediction, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold">{prediction.userName}</h3>
                        <Badge className={getRiskCategoryColor(prediction.riskCategory)}>
                          {prediction.riskCategory.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          Risk Score: {Math.round(prediction.riskScore * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">View Patient</Button>
                        <Button size="sm">Create Intervention</Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Risk Factors:</span>
                        <ul className="text-gray-600 mt-1">
                          {prediction.primaryRiskFactors.map((factor, i) => (
                            <li key={i} className="text-sm">• {factor}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Predicted Outcomes:</span>
                        <ul className="text-gray-600 mt-1">
                          {prediction.predictedOutcomes.map((outcome, i) => (
                            <li key={i} className="text-sm">• {outcome}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Confidence:</span>
                        <p className="text-gray-600">{Math.round(prediction.confidence * 100)}%</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Timeframe:</span>
                        <p className="text-gray-600">{prediction.timeframe}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="font-medium text-gray-700">Recommended Actions:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {prediction.recommendedActions.map((action, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {action}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Model Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Top Performing Model</h4>
                    <p className="text-blue-800 text-sm">
                      Cardiovascular Risk Model shows 87% accuracy with consistent performance across demographics.
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">Improvement Opportunity</h4>
                    <p className="text-yellow-800 text-sm">
                      Mental Health Risk Assessment could benefit from additional training data to improve accuracy.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Pattern Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-900 mb-2">Emerging Risk Patterns</h4>
                    <p className="text-red-800 text-sm">
                      Increased cardiovascular risk detected in the 45-55 age group, particularly among office workers.
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Successful Interventions</h4>
                    <p className="text-green-800 text-sm">
                      Early intervention programs show 73% success rate in risk reduction over 6 months.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
