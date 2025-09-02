'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';

interface SecurityAuditData {
  summary: {
    total_threats: number;
    active_threats: number;
    resolved_threats: number;
    compliance_score: number;
    last_scan: string;
  };
  threat_levels: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recent_events: SecurityEvent[];
}

interface SecurityEvent {
  id: number;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export function SecurityAudit() {
  const [auditData, setAuditData] = useState<SecurityAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.get('/admin/security-audit');

      if (response.success) {
        setAuditData(response.data);
      } else {
        throw new Error(response.error || 'Failed to load security audit data');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load security data');
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao carregar dados de segurança',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const runSecurityScan = async () => {
    try {
      const response = await apiService.post('/admin/security/scan');

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Varredura de segurança iniciada'
        });
        await loadSecurityData();
      } else {
        throw new Error(response.error || 'Failed to start security scan');
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao iniciar varredura',
        variant: 'destructive'
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading && !auditData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !auditData) {
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
          <h1 className="text-3xl font-bold text-gray-900">Auditoria de Segurança</h1>
          <p className="mt-2 text-gray-600">
            Monitore ameaças, conformidade e eventos de segurança
          </p>
        </div>
        <Button onClick={runSecurityScan}>
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Nova Varredura
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ameaças Ativas</CardTitle>
            <ShieldExclamationIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {auditData?.summary.active_threats || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              de {auditData?.summary.total_threats || 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontuação de Conformidade</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {auditData?.summary.compliance_score || 0}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Conformidade geral
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticas</CardTitle>
            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {auditData?.threat_levels.critical || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ameaças críticas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Varredura</CardTitle>
            <ClockIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {auditData?.summary.last_scan ? 
                new Date(auditData.summary.last_scan).toLocaleString() : 
                'Nunca'
              }
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Varredura automática
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="threats">Ameaças</TabsTrigger>
          <TabsTrigger value="logs">Logs de Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Threat Levels */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Ameaças</CardTitle>
                <CardDescription>
                  Ameaças por nível de severidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditData && Object.entries(auditData.threat_levels).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(level)}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Badge>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Events */}
            <Card>
              <CardHeader>
                <CardTitle>Eventos Recentes</CardTitle>
                <CardDescription>
                  Últimos eventos de segurança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditData?.recent_events.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event.event_type}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {event.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="threats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ameaças de Segurança</CardTitle>
              <CardDescription>
                Ameaças detectadas pelo sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditData?.recent_events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.event_type}</TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.description}</TableCell>
                      <TableCell>
                        {new Date(event.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Registro de ações administrativas e eventos do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Logs de auditoria serão exibidos aqui
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}