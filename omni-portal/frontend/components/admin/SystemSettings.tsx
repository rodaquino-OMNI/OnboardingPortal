'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CogIcon,
  ServerIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';

interface SystemSetting {
  id: number;
  category: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_sensitive: boolean;
  validation_rules?: any;
  last_modified_by?: number;
  last_modified_at?: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  response_time: number;
  error_rate: number;
  active_sessions: number;
  queue_size: number;
  last_check: string;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    load_average: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage_percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage_percentage: number;
  };
  database: {
    connections: number;
    queries_per_second: number;
    slow_queries: number;
    cache_hit_rate: number;
  };
}

const settingCategories = [
  { key: 'application', label: 'Aplicação', icon: CogIcon },
  { key: 'security', label: 'Segurança', icon: ShieldCheckIcon },
  { key: 'notifications', label: 'Notificações', icon: BellIcon },
  { key: 'performance', label: 'Performance', icon: ChartBarIcon },
  { key: 'integrations', label: 'Integrações', icon: ServerIcon }
];

export function SystemSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [activeCategory, setActiveCategory] = useState('application');
  const [settingValues, setSettingValues] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadSystemSettings();
    if (activeTab === 'health') {
      loadSystemHealth();
    }
    if (activeTab === 'metrics') {
      loadSystemMetrics();
    }
  }, [activeTab]);

  const loadSystemSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.get('/admin/system-settings');

      if (response.success) {
        setSettings(response.data);
        const initialValues: Record<string, any> = {};
        response.data.forEach((setting: SystemSetting) => {
          initialValues[setting.key] = setting.value;
        });
        setSettingValues(initialValues);
      } else {
        throw new Error(response.error || 'Failed to load system settings');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load system settings');
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao carregar configurações',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSystemHealth = async () => {
    try {
      const response = await apiService.get('/admin/system/health');

      if (response.success) {
        setSystemHealth(response.data);
      } else {
        throw new Error(response.error || 'Failed to load system health');
      }

    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao carregar status do sistema',
        variant: 'destructive'
      });
    }
  };

  const loadSystemMetrics = async () => {
    try {
      const response = await apiService.get('/admin/system/metrics');

      if (response.success) {
        setSystemMetrics(response.data);
      } else {
        throw new Error(response.error || 'Failed to load system metrics');
      }

    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao carregar métricas do sistema',
        variant: 'destructive'
      });
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettingValues(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);

      const changedSettings = settings.filter(setting => 
        settingValues[setting.key] !== setting.value
      ).map(setting => ({
        key: setting.key,
        value: settingValues[setting.key],
        type: setting.type
      }));

      if (changedSettings.length === 0) {
        toast({
          title: 'Info',
          description: 'Nenhuma alteração para salvar'
        });
        return;
      }

      const response = await apiService.put('/admin/system-settings', {
        settings: changedSettings
      });

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Configurações salvas com sucesso'
        });
        setHasChanges(false);
        await loadSystemSettings();
      } else {
        throw new Error(response.error || 'Failed to save settings');
      }

    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao salvar configurações',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSettingInput = (setting: SystemSetting) => {
    const value = settingValues[setting.key] ?? setting.value;

    switch (setting.type) {
      case 'boolean':
        return (
          <Switch
            checked={value}
            onCheckedChange={(checked) => handleSettingChange(setting.key, checked)}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.key, parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        );
      
      case 'json':
        return (
          <Textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleSettingChange(setting.key, parsed);
              } catch {
                handleSettingChange(setting.key, e.target.value);
              }
            }}
            placeholder="{}"
            className="font-mono text-sm"
            rows={4}
          />
        );
      
      default:
        return setting.is_sensitive ? (
          <Input
            type="password"
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            placeholder="••••••••"
          />
        ) : (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            placeholder="Valor da configuração"
          />
        );
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(3)].map((_, j) => (
                    <Skeleton key={j} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !settings.length) {
    return (
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações do Sistema</h1>
          <p className="mt-2 text-gray-600">
            Configure parâmetros do sistema e monitore a saúde da aplicação
          </p>
        </div>
        {hasChanges && (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={loadSystemSettings}>
              Reverter
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="health">Saúde do Sistema</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {settingCategories.map((category) => (
              <Button
                key={category.key}
                variant={activeCategory === category.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(category.key)}
              >
                <category.icon className="h-4 w-4 mr-2" />
                {category.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {settings
              .filter(setting => setting.category === activeCategory)
              .map((setting) => (
                <Card key={setting.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {setting.key.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </CardTitle>
                      {setting.is_sensitive && (
                        <Badge variant="destructive" className="text-xs">
                          Sensível
                        </Badge>
                      )}
                    </div>
                    {setting.description && (
                      <CardDescription>{setting.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={setting.key} className="text-sm font-medium">
                        Valor ({setting.type})
                      </Label>
                      <div className="mt-1">
                        {renderSettingInput(setting)}
                      </div>
                    </div>
                    
                    {setting.last_modified_at && (
                      <div className="text-xs text-gray-400">
                        Última modificação: {new Date(setting.last_modified_at).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            
            {settings.filter(s => s.category === activeCategory).length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">
                    Nenhuma configuração encontrada para esta categoria
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          {systemHealth && (
            <>
              <div className="grid gap-6 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
                    <ServerIcon className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getHealthStatusColor(systemHealth.status)}`}>
                      {systemHealth.status.toUpperCase()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Sistema {systemHealth.status === 'healthy' ? 'saudável' : systemHealth.status}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tempo Ativo</CardTitle>
                    <ClockIcon className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-green-600">
                      {formatUptime(systemHealth.uptime)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Uptime do sistema
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
                    <ChartBarIcon className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {systemHealth.response_time}ms
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Tempo médio
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
                    <CogIcon className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {systemHealth.active_sessions}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Usuários online
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          {systemMetrics && (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU</CardTitle>
                    <CpuChipIcon className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {systemMetrics.cpu.usage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Load: {systemMetrics.cpu.load_average[0]?.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memória</CardTitle>
                    <ServerIcon className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {systemMetrics.memory.usage_percentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Disco</CardTitle>
                    <CircleStackIcon className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {systemMetrics.disk.usage_percentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(systemMetrics.disk.used)} / {formatBytes(systemMetrics.disk.total)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Banco de Dados</CardTitle>
                    <CircleStackIcon className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {systemMetrics.database.connections}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Conexões ativas
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}