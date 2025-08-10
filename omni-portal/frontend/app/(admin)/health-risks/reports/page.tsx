'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText,
  Download,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  FileJson,
  Loader2,
  Eye
} from 'lucide-react';
import { healthRisksApi } from '@/lib/api/admin/health-risks';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

interface ClinicalReport {
  id: string;
  report_type: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  file_size?: number;
  generated_at?: string;
  requested_at: string;
  requested_by: {
    id: string;
    name: string;
  };
  parameters: {
    timeframe: string;
    filters?: {
      priority?: string[];
      categories?: string[];
    };
  };
  metadata?: {
    total_alerts?: number;
    total_beneficiaries?: number;
    processing_time?: number;
  };
}

export default function ReportsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadReports, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadReports = async () => {
    try {
      setError(null);
      const response = await healthRisksApi.reports.list();
      setReports(response.data.data);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (report: ClinicalReport) => {
    if (!report.file_url || report.status !== 'completed') return;

    try {
      setDownloadingId(report.id);
      const response = await healthRisksApi.reports.download(report.id);
      
      // Create blob from response
      const blob = new Blob([response.data], { 
        type: getContentType(report.format) 
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clinical-report-${report.id}.${report.format}`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Erro ao baixar relatório');
    } finally {
      setDownloadingId(null);
    }
  };

  const getContentType = (format: string) => {
    switch (format) {
      case 'pdf': return 'application/pdf';
      case 'excel': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      default: return 'application/octet-stream';
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-600" />;
      case 'excel': return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case 'json': return <FileJson className="w-5 h-5 text-blue-600" />;
      case 'csv': return <FileText className="w-5 h-5 text-gray-600" />;
      default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50">Pendente</Badge>;
      case 'processing':
        return (
          <Badge variant="outline" className="bg-blue-50">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Falhou
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Relatórios Clínicos
          </h1>
          <p className="text-gray-600 mt-1">
            Visualize e baixe relatórios gerados
          </p>
        </div>
        
        <Link href="/admin/health-risks/reports/generate">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Relatório
          </Button>
        </Link>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Reports Table */}
      <Card className="overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Nenhum relatório encontrado</p>
            <Link href="/admin/health-risks/reports/generate">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Gerar Primeiro Relatório
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Formato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solicitado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Período
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tamanho
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 capitalize">
                        {report.report_type.replace('_', ' ')}
                      </div>
                      {report.metadata?.total_alerts && (
                        <div className="text-xs text-gray-500">
                          {report.metadata.total_alerts} alertas
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getFormatIcon(report.format)}
                        <span className="text-sm font-medium uppercase">
                          {report.format}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium">{report.requested_by.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(report.requested_at), { 
                            addSuffix: true,
                            locale: ptBR 
                          })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <Calendar className="w-4 h-4 inline mr-1 text-gray-400" />
                        {report.parameters.timeframe}
                      </div>
                      {report.parameters.filters && (
                        <div className="text-xs text-gray-500">
                          {Object.keys(report.parameters.filters).length} filtros
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatFileSize(report.file_size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {report.status === 'completed' && report.file_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(report)}
                            disabled={downloadingId === report.id}
                          >
                            {downloadingId === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <Link href={`/admin/health-risks/reports/${report.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}