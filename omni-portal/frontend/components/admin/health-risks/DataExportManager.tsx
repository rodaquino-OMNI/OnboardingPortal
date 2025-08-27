'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Calendar,
  Filter,
  Settings,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  Eye,
  Shield
} from 'lucide-react';
import { healthRisksApi, type AlertFilters } from '@/lib/api/admin/health-risks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportFilter extends AlertFilters {
  include_beneficiary_details?: boolean;
  include_medical_history?: boolean;
  include_interventions?: boolean;
  include_timeline?: boolean;
  anonymize_data?: boolean;
  date_from?: string;
  date_to?: string;
}

interface ExportJob {
  id: string;
  type: 'csv' | 'excel' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  download_url?: string;
  file_size?: number;
  records_count?: number;
  error_message?: string;
}

export function DataExportManager() {
  const [activeTab, setActiveTab] = useState('quick');
  const [exporting, setExporting] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([
    {
      id: '1',
      type: 'excel',
      status: 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      download_url: '/mock-export.xlsx',
      file_size: 2.4,
      records_count: 156
    },
    {
      id: '2',
      type: 'pdf',
      status: 'processing',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      records_count: 89
    }
  ]);

  // Export configuration state
  const [exportConfig, setExportConfig] = useState<{
    format: 'csv' | 'excel' | 'pdf';
    filters: ExportFilter;
    fields: string[];
    schedule?: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
      day_of_week?: number;
      day_of_month?: number;
      time: string;
      email_recipients: string[];
    };
  }>({
    format: 'excel',
    filters: {
      include_beneficiary_details: true,
      include_medical_history: false,
      include_interventions: true,
      include_timeline: false,
      anonymize_data: false
    },
    fields: ['id', 'beneficiary_name', 'alert_type', 'priority', 'status', 'created_at']
  });

  const availableFields = [
    { id: 'id', label: 'ID do Alerta', required: true },
    { id: 'beneficiary_name', label: 'Nome do Beneficiário', sensitive: true },
    { id: 'beneficiary_id', label: 'ID do Beneficiário' },
    { id: 'alert_type', label: 'Tipo de Alerta' },
    { id: 'category', label: 'Categoria' },
    { id: 'priority', label: 'Prioridade' },
    { id: 'status', label: 'Status' },
    { id: 'risk_score', label: 'Score de Risco' },
    { id: 'created_at', label: 'Data de Criação' },
    { id: 'acknowledged_at', label: 'Data de Reconhecimento' },
    { id: 'resolved_at', label: 'Data de Resolução' },
    { id: 'sla_deadline', label: 'Prazo SLA' },
    { id: 'sla_status', label: 'Status SLA' },
    { id: 'assigned_to', label: 'Atribuído a' }
  ];

  const handleQuickExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      setExporting(true);
      const response = await healthRisksApi.exportAlerts({
        format,
        status: '',
        priority: '',
        category: ''
      });

      // Simulate export job creation
      const newJob: ExportJob = {
        id: Date.now().toString(),
        type: format,
        status: 'processing',
        created_at: new Date().toISOString(),
        records_count: 156
      };

      setExportJobs(prev => [newJob, ...prev]);

      // Simulate completion after 3 seconds
      setTimeout(() => {
        setExportJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? { ...job, status: 'completed', completed_at: new Date().toISOString(), download_url: response.download_url, file_size: 2.1 }
            : job
        ));
      }, 3000);

    } catch (error) {
      console.error('Error starting export:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleCustomExport = async () => {
    try {
      setExporting(true);
      const response = await healthRisksApi.exportAlerts({
        ...exportConfig.filters,
        format: exportConfig.format
      });

      const newJob: ExportJob = {
        id: Date.now().toString(),
        type: exportConfig.format,
        status: 'processing',
        created_at: new Date().toISOString(),
        records_count: 89
      };

      setExportJobs(prev => [newJob, ...prev]);

      setTimeout(() => {
        setExportJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? { ...job, status: 'completed', completed_at: new Date().toISOString(), download_url: response.download_url, file_size: 1.8 }
            : job
        ));
      }, 2000);

    } catch (error) {
      console.error('Error starting custom export:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = (job: ExportJob) => {
    if (job.download_url) {
      window.open(job.download_url, '_blank');
    }
  };

  const getJobStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600 animate-pulse" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getFileTypeIcon = (type: 'csv' | 'excel' | 'pdf') => {
    switch (type) {
      case 'excel':
        return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Exportação de Dados</h2>
          <p className="text-gray-600">Exporte alertas de saúde em diferentes formatos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quick">Exportação Rápida</TabsTrigger>
          <TabsTrigger value="custom">Exportação Customizada</TabsTrigger>
          <TabsTrigger value="scheduled">Agendamentos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exportação Rápida</CardTitle>
              <CardDescription>
                Exporte todos os alertas ativos em formatos comuns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => handleQuickExport('excel')}
                  disabled={exporting}
                >
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <span>Exportar Excel</span>
                  <span className="text-xs text-gray-500">Planilha completa</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => handleQuickExport('csv')}
                  disabled={exporting}
                >
                  <FileText className="w-8 h-8 text-blue-600" />
                  <span>Exportar CSV</span>
                  <span className="text-xs text-gray-500">Dados tabulares</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => handleQuickExport('pdf')}
                  disabled={exporting}
                >
                  <FileText className="w-8 h-8 text-red-600" />
                  <span>Exportar PDF</span>
                  <span className="text-xs text-gray-500">Relatório formatado</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuração de Exportação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Formato</label>
                  <div className="flex gap-2">
                    {['excel', 'csv', 'pdf'].map((format) => (
                      <Button
                        key={format}
                        variant={exportConfig.format === format ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setExportConfig(prev => ({ ...prev, format: format as any }))}
                      >
                        {getFileTypeIcon(format as any)}
                        <span className="ml-2 capitalize">{format}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Data Início</label>
                    <Input
                      type="date"
                      value={exportConfig.filters.date_from || ''}
                      onChange={(e) => setExportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, date_from: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Data Fim</label>
                    <Input
                      type="date"
                      value={exportConfig.filters.date_to || ''}
                      onChange={(e) => setExportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, date_to: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Filtros</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={exportConfig.filters.status || ''}
                      onChange={(e) => setExportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, status: e.target.value }
                      }))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Todos os Status</option>
                      <option value="pending">Pendente</option>
                      <option value="acknowledged">Reconhecido</option>
                      <option value="resolved">Resolvido</option>
                    </select>

                    <select
                      value={exportConfig.filters.priority || ''}
                      onChange={(e) => setExportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, priority: e.target.value }
                      }))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Todas as Prioridades</option>
                      <option value="emergency">Emergência</option>
                      <option value="urgent">Urgente</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Opções de Dados</label>
                  <div className="space-y-2">
                    {[
                      { key: 'include_beneficiary_details', label: 'Incluir detalhes do beneficiário' },
                      { key: 'include_medical_history', label: 'Incluir histórico médico', sensitive: true },
                      { key: 'include_interventions', label: 'Incluir intervenções' },
                      { key: 'include_timeline', label: 'Incluir linha do tempo' },
                      { key: 'anonymize_data', label: 'Anonimizar dados pessoais' }
                    ].map((option) => (
                      <div key={option.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={option.key}
                          checked={(exportConfig.filters as any)[option.key] || false}
                          onCheckedChange={(checked) =>
                            setExportConfig(prev => ({
                              ...prev,
                              filters: { ...prev.filters, [option.key]: checked }
                            }))
                          }
                        />
                        <label htmlFor={option.key} className="text-sm flex items-center gap-1">
                          {option.label}
                          {option.sensitive && <Shield className="w-3 h-3 text-amber-500" />}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCustomExport}
                  disabled={exporting}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? 'Processando...' : 'Iniciar Exportação'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campos para Exportação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={field.id}
                          checked={exportConfig.fields.includes(field.id)}
                          disabled={field.required}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setExportConfig(prev => ({
                                ...prev,
                                fields: [...prev.fields, field.id]
                              }));
                            } else {
                              setExportConfig(prev => ({
                                ...prev,
                                fields: prev.fields.filter(f => f !== field.id)
                              }));
                            }
                          }}
                        />
                        <label htmlFor={field.id} className="text-sm">
                          {field.label}
                        </label>
                      </div>
                      <div className="flex gap-1">
                        {field.required && <Badge variant="secondary">Obrigatório</Badge>}
                        {field.sensitive && <Badge variant="outline">Sensível</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exportações Agendadas</CardTitle>
              <CardDescription>
                Configure exportações automáticas recorrentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4" />
                <p>Nenhuma exportação agendada</p>
                <Button variant="outline" className="mt-4">
                  <Send className="w-4 h-4 mr-2" />
                  Criar Agendamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Exportações</CardTitle>
              <CardDescription>
                Acompanhe o status e baixe exportações anteriores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {exportJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getFileTypeIcon(job.type)}
                        {getJobStatusIcon(job.status)}
                      </div>
                      <div>
                        <div className="font-medium">
                          Exportação {job.type.toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-600">
                          {format(new Date(job.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {job.records_count && ` • ${job.records_count} registros`}
                          {job.file_size && ` • ${job.file_size} MB`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          job.status === 'completed' ? 'default' :
                          job.status === 'processing' ? 'secondary' :
                          job.status === 'failed' ? 'destructive' : 'outline'
                        }
                      >
                        {job.status === 'completed' && 'Concluído'}
                        {job.status === 'processing' && 'Processando'}
                        {job.status === 'failed' && 'Erro'}
                        {job.status === 'pending' && 'Pendente'}
                      </Badge>
                      {job.status === 'completed' && job.download_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(job)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar
                        </Button>
                      )}
                      {job.status === 'processing' && (
                        <Button size="sm" variant="outline" disabled>
                          <Eye className="w-4 h-4 mr-2" />
                          Aguardar
                        </Button>
                      )}
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