'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText,
  Download,
  Calendar,
  Filter,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  FileJson,
  ArrowLeft
} from 'lucide-react';
import { healthRisksApi, ReportGenerationData } from '@/lib/api/admin/health-risks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportConfig extends ReportGenerationData {
  selectedCategories: string[];
  selectedPriorities: string[];
}

export default function GenerateReportPage() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  
  const [config, setConfig] = useState<ReportConfig>({
    report_type: 'summary',
    format: 'pdf',
    timeframe: '30days',
    filters: {
      priority: [],
      categories: []
    },
    include_charts: true,
    include_recommendations: true,
    selectedCategories: [],
    selectedPriorities: []
  });

  const reportTypes = [
    { value: 'summary', label: 'Resumo Executivo', description: 'Visão geral dos riscos e métricas' },
    { value: 'detailed', label: 'Relatório Detalhado', description: 'Análise completa com todos os alertas' },
    { value: 'interventions', label: 'Intervenções Realizadas', description: 'Histórico de ações e resultados' },
    { value: 'outcomes', label: 'Resultados Clínicos', description: 'Análise de efetividade e desfechos' }
  ];

  const formats = [
    { value: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-600' },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'text-green-600' },
    { value: 'json', label: 'JSON', icon: FileJson, color: 'text-blue-600' },
    { value: 'csv', label: 'CSV', icon: FileText, color: 'text-gray-600' }
  ];

  const timeframes = [
    { value: '24hours', label: 'Últimas 24 horas' },
    { value: '7days', label: 'Últimos 7 dias' },
    { value: '30days', label: 'Últimos 30 dias' },
    { value: '90days', label: 'Últimos 90 dias' },
    { value: 'custom', label: 'Período customizado' }
  ];

  const categories = [
    { value: 'cardiovascular', label: 'Cardiovascular' },
    { value: 'mental_health', label: 'Saúde Mental' },
    { value: 'substance_abuse', label: 'Uso de Substâncias' },
    { value: 'chronic_disease', label: 'Doença Crônica' },
    { value: 'safety_risk', label: 'Risco de Segurança' }
  ];

  const priorities = [
    { value: 'emergency', label: 'Emergência', color: 'bg-red-600' },
    { value: 'urgent', label: 'Urgente', color: 'bg-orange-600' },
    { value: 'high', label: 'Alta', color: 'bg-yellow-600' },
    { value: 'medium', label: 'Média', color: 'bg-blue-600' },
    { value: 'low', label: 'Baixa', color: 'bg-gray-600' }
  ];

  const handleCategoryToggle = (category: string) => {
    setConfig(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(category)
        ? prev.selectedCategories.filter(c => c !== category)
        : [...prev.selectedCategories, category]
    }));
  };

  const handlePriorityToggle = (priority: string) => {
    setConfig(prev => ({
      ...prev,
      selectedPriorities: prev.selectedPriorities.includes(priority)
        ? prev.selectedPriorities.filter(p => p !== priority)
        : [...prev.selectedPriorities, priority]
    }));
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(false);

      const reportData: ReportGenerationData = {
        report_type: config.report_type,
        format: config.format,
        timeframe: config.timeframe,
        filters: {
          ...(config.selectedPriorities.length > 0 && { priority: config.selectedPriorities }),
          ...(config.selectedCategories.length > 0 && { categories: config.selectedCategories })
        },
        include_charts: config.include_charts ?? false,
        include_recommendations: config.include_recommendations ?? false
      };

      const response = await healthRisksApi.reports.generate(reportData);
      
      setReportId((response.data as any).report_id);
      setSuccess(true);
      
      // Redirect to reports list after 3 seconds
      setTimeout(() => {
        router.push('/admin/health-risks/reports');
      }, 3000);
      
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Erro ao gerar relatório. Por favor, tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const getFormatIcon = (format: string) => {
    const fmt = formats.find(f => f.value === format);
    if (!fmt) return null;
    const Icon = fmt.icon;
    return <Icon className={`w-5 h-5 ${fmt.color}`} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gerar Relatório Clínico
          </h1>
          <p className="text-gray-600 mt-1">
            Configure e gere relatórios personalizados de riscos de saúde
          </p>
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Relatório gerado com sucesso! ID: {reportId}. Redirecionando...
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Type */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Tipo de Relatório</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => setConfig({ ...config, report_type: type.value as any })}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    config.report_type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{type.label}</div>
                  <div className="text-sm text-gray-600 mt-1">{type.description}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Timeframe */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Período</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {timeframes.map((timeframe) => (
                <Button
                  key={timeframe.value}
                  variant={config.timeframe === timeframe.value ? 'primary' : 'outline'}
                  onClick={() => setConfig({ ...config, timeframe: timeframe.value })}
                  className="justify-start"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {timeframe.label}
                </Button>
              ))}
            </div>
          </Card>

          {/* Filters */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Filtros</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Categorias</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Badge
                      key={category.value}
                      variant={config.selectedCategories.includes(category.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleCategoryToggle(category.value)}
                    >
                      {config.selectedCategories.includes(category.value) && (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      {category.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Prioridades</Label>
                <div className="flex flex-wrap gap-2">
                  {priorities.map((priority) => (
                    <Badge
                      key={priority.value}
                      variant={config.selectedPriorities.includes(priority.value) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        config.selectedPriorities.includes(priority.value) ? priority.color : ''
                      }`}
                      onClick={() => handlePriorityToggle(priority.value)}
                    >
                      {config.selectedPriorities.includes(priority.value) && (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      {priority.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Options */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Opções Adicionais</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.include_charts}
                  onChange={(e) => setConfig({ ...config, include_charts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span>Incluir gráficos e visualizações</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.include_recommendations}
                  onChange={(e) => setConfig({ ...config, include_recommendations: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span>Incluir recomendações clínicas</span>
              </label>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Format Selection */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Formato de Saída</h3>
            <div className="space-y-3">
              {formats.map((format) => (
                <div
                  key={format.value}
                  onClick={() => setConfig({ ...config, format: format.value as any })}
                  className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center gap-3 ${
                    config.format === format.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <format.icon className={`w-5 h-5 ${format.color}`} />
                  <span className="font-medium">{format.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-6 bg-gray-50">
            <h3 className="font-semibold mb-4">Resumo da Configuração</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Tipo:</span>
                <span className="ml-2 font-medium">
                  {reportTypes.find(t => t.value === config.report_type)?.label}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Formato:</span>
                <span className="ml-2 font-medium flex items-center gap-2 inline-flex">
                  {getFormatIcon(config.format)}
                  {config.format.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Período:</span>
                <span className="ml-2 font-medium">
                  {timeframes.find(t => t.value === config.timeframe)?.label}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Filtros:</span>
                <span className="ml-2 font-medium">
                  {config.selectedCategories.length + config.selectedPriorities.length} ativos
                </span>
              </div>
            </div>

            <Button
              className="w-full mt-6"
              onClick={handleGenerate}
              disabled={generating || success}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando Relatório...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Relatório Gerado!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}