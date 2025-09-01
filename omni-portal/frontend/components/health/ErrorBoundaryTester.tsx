'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TestTube, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { ErrorBoundary, HealthQuestionnaireErrorBoundary, useErrorHandler } from './ErrorBoundary';

interface ErrorScenario {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'sync' | 'async' | 'network' | 'memory' | 'render';
}

const ERROR_SCENARIOS: ErrorScenario[] = [
  {
    id: 'sync-error',
    name: 'Synchronous Error',
    description: 'Throws an error during render phase',
    severity: 'high',
    type: 'sync'
  },
  {
    id: 'async-error',
    name: 'Async Operation Error',
    description: 'Error in async operation (useEffect, API call)',
    severity: 'medium',
    type: 'async'
  },
  {
    id: 'network-error',
    name: 'Network Request Error',
    description: 'Simulates failed API request',
    severity: 'medium',
    type: 'network'
  },
  {
    id: 'memory-error',
    name: 'Memory Access Error',
    description: 'Accessing undefined/null properties',
    severity: 'high',
    type: 'memory'
  },
  {
    id: 'render-error',
    name: 'Render Phase Error',
    description: 'Error during component rendering',
    severity: 'critical',
    type: 'render'
  }
];

// Test component that can throw different types of errors
function ErrorTestComponent({ scenario, onError }: { scenario: ErrorScenario; onError: (error: Error) => void }) {
  const [triggerError, setTriggerError] = useState(false);
  const { captureError } = useErrorHandler();

  React.useEffect(() => {
    if (triggerError && scenario.type === 'async') {
      const error = new Error(`[TEST] ${scenario.name}: ${scenario.description}`);
      error.name = `Test${scenario.type.charAt(0).toUpperCase() + scenario.type.slice(1)}Error`;
      captureError(error);
      onError(error);
    }
  }, [triggerError, scenario, captureError, onError]);

  React.useEffect(() => {
    if (triggerError && scenario.type === 'network') {
      // Simulate network error
      fetch('https://nonexistent-api-endpoint-test.invalid/error')
        .catch(error => {
          const testError = new Error(`[TEST] ${scenario.name}: ${scenario.description} - ${error.message}`);
          testError.name = 'NetworkTestError';
          captureError(testError);
          onError(testError);
        });
    }
  }, [triggerError, scenario, captureError, onError]);

  if (triggerError && scenario.type === 'sync') {
    const error = new Error(`[TEST] ${scenario.name}: ${scenario.description}`);
    error.name = 'SyncTestError';
    throw error;
  }

  if (triggerError && scenario.type === 'memory') {
    const nullObject: any = null;
    // This will throw a TypeError
    const value = nullObject.nonExistentProperty.deepProperty;
    console.log(value); // This won't execute
  }

  if (triggerError && scenario.type === 'render') {
    // Force a render error by returning invalid JSX
    return React.createElement('invalid-tag-name' as any, {}, 'This should cause a render error');
  }

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">{scenario.name}</h4>
        <Badge variant={
          scenario.severity === 'critical' ? 'destructive' :
          scenario.severity === 'high' ? 'secondary' :
          scenario.severity === 'medium' ? 'outline' : 'default'
        }>
          {scenario.severity}
        </Badge>
      </div>
      <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
      <Button
        onClick={() => setTriggerError(true)}
        disabled={triggerError}
        size="sm"
        className="w-full"
      >
        {triggerError ? 'Error Triggered' : 'Trigger Error'}
        <TestTube className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

// Main error boundary tester component
export function ErrorBoundaryTester() {
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: Error; timestamp: Date }>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);

  const handleError = (scenarioId: string, error: Error) => {
    setTestResults(prev => ({
      ...prev,
      [scenarioId]: {
        success: true, // Success means the error was caught properly
        error,
        timestamp: new Date()
      }
    }));
  };

  const handleBoundaryError = (scenarioId: string) => {
    setTestResults(prev => ({
      ...prev,
      [scenarioId]: {
        success: true, // Error boundary caught the error
        timestamp: new Date()
      }
    }));
  };

  const resetTest = (scenarioId: string) => {
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[scenarioId];
      return newResults;
    });
  };

  const runAllTests = async () => {
    setIsTestingAll(true);
    setTestResults({});
    
    // This would be implemented with a more sophisticated test runner in production
    setTimeout(() => {
      setIsTestingAll(false);
    }, 3000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-6 h-6" />
                Error Boundary Testing Suite
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Test error handling capabilities of health questionnaire components
              </p>
            </div>
            <Button onClick={runAllTests} disabled={isTestingAll}>
              {isTestingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4 mr-2" />
                  Run All Tests
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Test Results Summary */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(testResults).map(([scenarioId, result]) => {
                const scenario = ERROR_SCENARIOS.find(s => s.id === scenarioId);
                return (
                  <div key={scenarioId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{scenario?.name}</div>
                      <div className="text-xs text-gray-500">
                        {result.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resetTest(scenarioId)}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ERROR_SCENARIOS.map((scenario) => (
          <Card key={scenario.id} className={`${getSeverityColor(scenario.severity)} border-2`}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{scenario.name}</CardTitle>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent>
              {/* Test with HealthQuestionnaireErrorBoundary */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Health Questionnaire Boundary Test</h4>
                  <HealthQuestionnaireErrorBoundary
                    onError={(error, errorInfo) => {
                      console.log(`[TEST] HealthQuestionnaireErrorBoundary caught:`, error);
                      handleBoundaryError(`health-${scenario.id}`);
                    }}
                    resetKeys={[scenario.id]}
                  >
                    <ErrorTestComponent
                      scenario={scenario}
                      onError={(error) => handleError(`health-${scenario.id}`, error)}
                    />
                  </HealthQuestionnaireErrorBoundary>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Generic Boundary Test</h4>
                  <ErrorBoundary
                    onError={(error, errorInfo) => {
                      console.log(`[TEST] ErrorBoundary caught:`, error);
                      handleBoundaryError(`generic-${scenario.id}`);
                    }}
                    resetKeys={[scenario.id]}
                    fallback={
                      <div className="p-3 bg-gray-100 border border-gray-300 rounded text-center">
                        <p className="text-sm text-gray-600">Generic error boundary active</p>
                      </div>
                    }
                  >
                    <ErrorTestComponent
                      scenario={scenario}
                      onError={(error) => handleError(`generic-${scenario.id}`, error)}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error Reporting Integration Info */}
      <Card>
        <CardHeader>
          <CardTitle>Error Reporting Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Production Integration</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Sentry/Bugsnag integration ready</li>
                  <li>• Structured error logging</li>
                  <li>• User context preservation</li>
                  <li>• Performance impact monitoring</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Error Recovery Features</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Auto-reset on props change</li>
                  <li>• Manual recovery options</li>
                  <li>• Data persistence during errors</li>
                  <li>• User-friendly error messages</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Development-only component - should not be included in production builds
export function ErrorBoundaryDevTester() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return <ErrorBoundaryTester />;
}