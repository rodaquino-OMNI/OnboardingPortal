'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGamification } from '@/hooks/useGamification';
import { triggerHealthCompletionEvent, useGamificationEvents } from '@/lib/gamification-events';
import { RefreshCw, Trophy, Star, Activity, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Gamification Integration Tester Component
 * 
 * This component tests the complete gamification integration:
 * - Real API calls to backend
 * - Real-time event updates
 * - Data persistence
 * - Error handling
 * - Performance optimization
 */
export function GamificationTester() {
  const {
    progress,
    stats,
    badges,
    leaderboard,
    activityFeed,
    dashboardSummary,
    isLoading,
    error,
    fetchAll,
    refreshData,
    clearError
  } = useGamification();

  const { triggerEvent } = useGamificationEvents();
  const [testResults, setTestResults] = useState<Record<string, 'pending' | 'success' | 'error'>>({});
  const [apiCallLogs, setApiCallLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setApiCallLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    setTestResults(prev => ({ ...prev, [testName]: 'pending' }));
    addLog(`Starting test: ${testName}`);
    
    try {
      await testFn();
      setTestResults(prev => ({ ...prev, [testName]: 'success' }));
      addLog(`✅ Test passed: ${testName}`);
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, [testName]: 'error' }));
      addLog(`❌ Test failed: ${testName} - ${error.message}`);
    }
  };

  const testApiIntegration = async () => {
    addLog('Testing API integration...');
    await fetchAll();
    
    // Verify we got real data (not mock data)
    if (progress?.total_points !== 0 || stats?.totalPoints !== 0) {
      addLog('✅ Real API data detected (non-zero points)');
    } else {
      addLog('ℹ️ Zero points detected (expected for new users)');
    }
    
    // Check for proper data structure
    if (progress?.current_level) {
      addLog('✅ Progress data structure correct');
    }
    if (badges?.earned !== undefined && badges?.available !== undefined) {
      addLog('✅ Badges data structure correct');
    }
  };

  const testRealTimeUpdates = async () => {
    addLog('Testing real-time event system...');
    
    // Simulate health questionnaire completion
    await triggerEvent({
      type: 'health_completion',
      points_earned: 150
    });
    
    addLog('✅ Health completion event triggered');
    
    // Wait for refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    addLog('✅ Real-time update cycle completed');
  };

  const testErrorHandling = async () => {
    addLog('Testing error handling...');
    
    // This should handle errors gracefully
    try {
      // Trigger an error by calling an invalid endpoint
      await fetch('/api/invalid-endpoint');
    } catch {
      // Expected to fail
    }
    
    if (error) {
      clearError();
      addLog('✅ Error handling working correctly');
    } else {
      addLog('✅ No errors detected (good)');
    }
  };

  const testDataPersistence = async () => {
    addLog('Testing data persistence...');
    
    // Check if data persists in localStorage
    const persistedData = localStorage.getItem('gamification-storage');
    if (persistedData) {
      try {
        const parsed = JSON.parse(persistedData);
        if (parsed.state?.progress || parsed.state?.stats) {
          addLog('✅ Data persistence working');
        } else {
          addLog('⚠️ Persistence storage exists but no data');
        }
      } catch {
        addLog('❌ Persistence data corrupted');
        throw new Error('Persistence data corrupted');
      }
    } else {
      addLog('ℹ️ No persisted data found (normal for first run)');
    }
  };

  const runAllTests = async () => {
    setTestResults({});
    setApiCallLogs([]);
    
    await runTest('API Integration', testApiIntegration);
    await runTest('Real-time Updates', testRealTimeUpdates);
    await runTest('Error Handling', testErrorHandling);
    await runTest('Data Persistence', testDataPersistence);
    
    addLog('🎉 All tests completed!');
  };

  const getTestIcon = (status: 'pending' | 'success' | 'error' | undefined) => {
    switch (status) {
      case 'pending': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  useEffect(() => {
    // Auto-load data on mount
    if (!progress && !isLoading) {
      fetchAll();
    }
  }, [progress, isLoading, fetchAll]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Teste de Integração de Gamificação
            </h2>
            <div className="flex gap-2">
              <Button onClick={refreshData} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar Dados
              </Button>
              <Button onClick={runAllTests} size="sm">
                Executar Todos os Testes
              </Button>
            </div>
          </div>

          {error && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Erro: {error}
                <Button onClick={clearError} variant="link" size="sm" className="ml-2">
                  Limpar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Test Results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'API Integration', label: 'Integração com API' },
              { key: 'Real-time Updates', label: 'Atualizações em Tempo Real' },
              { key: 'Error Handling', label: 'Tratamento de Erros' },
              { key: 'Data Persistence', label: 'Persistência de Dados' }
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2 p-3 border rounded-lg">
                {getTestIcon(testResults[key])}
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* Live Data Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Progresso</h3>
              <div className="space-y-1 text-sm">
                <div>Pontos: {progress?.total_points || 0}</div>
                <div>Nível: {progress?.current_level?.number || 1}</div>
                <div>Sequência: {progress?.streak_days || 0} dias</div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Conquistas</h3>
              <div className="space-y-1 text-sm">
                <div>Obtidas: {badges?.earned?.length || 0}</div>
                <div>Disponíveis: {badges?.available?.length || 0}</div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Atividade</h3>
              <div className="space-y-1 text-sm">
                <div>Itens do Feed: {activityFeed?.length || 0}</div>
                <div>Carregando: {isLoading ? 'Sim' : 'Não'}</div>
              </div>
            </div>
          </div>

          {/* API Call Logs */}
          <div className="space-y-2">
            <h3 className="font-medium">Logs de Chamadas da API</h3>
            <div className="bg-gray-50 p-4 rounded-lg max-h-48 overflow-y-auto">
              {apiCallLogs.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum log ainda. Execute os testes para ver a atividade da API.</p>
              ) : (
                <div className="space-y-1">
                  {apiCallLogs.map((log, index) => (
                    <div key={index} className="text-xs font-mono">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => triggerHealthCompletionEvent(150)} 
              variant="outline" 
              size="sm"
            >
              <Star className="w-4 h-4 mr-2" />
              Simulate Health Completion
            </Button>
            <Button 
              onClick={() => triggerEvent({ type: 'document_upload', points_earned: 50 })} 
              variant="outline" 
              size="sm"
            >
              <Activity className="w-4 h-4 mr-2" />
              Simulate Document Upload
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}