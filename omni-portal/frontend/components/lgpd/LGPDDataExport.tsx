'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useLGPD } from '@/hooks/useLGPD';
import { 
  Download, 
  FileText, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  HardDrive,
  Archive,
  File
} from 'lucide-react';

export function LGPDDataExport() {
  const { exportUserData, exportUserDataPdf, isLoading } = useLGPD();
  const [exportStatus, setExportStatus] = useState<{
    type: 'success' | 'error' | 'warning' | null;
    message: string;
    downloadUrl?: string;
    expiresAt?: string;
    fileSize?: number;
  }>({ type: null, message: '' });

  const handleExportJSON = async () => {
    try {
      const result = await exportUserData();
      setExportStatus({
        type: 'success',
        message: 'Exportação JSON gerada com sucesso!',
        downloadUrl: result.download_url,
        expiresAt: result.expires_at,
        fileSize: result.file_size
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: 'Erro ao gerar exportação JSON. Tente novamente.'
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      const result = await exportUserDataPdf();
      setExportStatus({
        type: 'success',
        message: 'Exportação PDF gerada com sucesso!',
        downloadUrl: result.download_url,
        expiresAt: result.expires_at,
        fileSize: result.file_size
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: 'Erro ao gerar exportação PDF. Tente novamente.'
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getExpirationTime = (expiresAt: string) => {
    const expiration = new Date(expiresAt);
    const now = new Date();
    const diffMinutes = Math.floor((expiration.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffMinutes > 60) {
      return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`;
    }
    return `${diffMinutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Information Card */}
      <Card className="p-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Direito de Acesso aos Dados</h3>
            <p className="text-gray-600 mb-4">
              Conforme o Art. 15 da LGPD, você tem o direito de obter do controlador 
              a confirmação de que os dados pessoais que lhe digam respeito são ou não 
              objeto de tratamento e, se for esse o caso, o acesso aos dados pessoais.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <strong>Importante:</strong> Os arquivos de exportação ficam disponíveis 
                  por apenas 1 hora por motivos de segurança.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* JSON Export */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Archive className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Exportação JSON</h3>
              <p className="text-sm text-gray-600">Formato estruturado para análise técnica</p>
            </div>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Formato:</span>
              <Badge variant="secondary">JSON</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Compatibilidade:</span>
              <span className="text-gray-900">Sistemas técnicos</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tamanho estimado:</span>
              <span className="text-gray-900">50-200 KB</span>
            </div>
          </div>

          <div className="space-y-2 mb-4 text-sm text-gray-600">
            <h4 className="font-medium text-gray-900">Dados incluídos:</h4>
            <ul className="space-y-1">
              <li>• Informações do perfil</li>
              <li>• Dados de beneficiário</li>
              <li>• Histórico de documentos</li>
              <li>• Questionários de saúde</li>
              <li>• Registros de entrevistas</li>
              <li>• Progresso de gamificação</li>
              <li>• Histórico de auditoria</li>
            </ul>
          </div>

          <Button
            onClick={handleExportJSON}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar JSON
              </>
            )}
          </Button>
        </Card>

        {/* PDF Export */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <FileText className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold">Exportação PDF</h3>
              <p className="text-sm text-gray-600">Formato legível para impressão</p>
            </div>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Formato:</span>
              <Badge variant="secondary">PDF</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Compatibilidade:</span>
              <span className="text-gray-900">Leitura humana</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tamanho estimado:</span>
              <span className="text-gray-900">200-500 KB</span>
            </div>
          </div>

          <div className="space-y-2 mb-4 text-sm text-gray-600">
            <h4 className="font-medium text-gray-900">Características:</h4>
            <ul className="space-y-1">
              <li>• Formato bem estruturado</li>
              <li>• Fácil leitura</li>
              <li>• Pronto para impressão</li>
              <li>• Inclui cabeçalho LGPD</li>
              <li>• Assinatura digital</li>
              <li>• Dados organizados por seção</li>
            </ul>
          </div>

          <Button
            onClick={handleExportPDF}
            disabled={isLoading}
            className="w-full"
            variant="outline"
          >
            {isLoading ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Exportar PDF
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* Export Status */}
      {exportStatus.type && (
        <Alert
          type={exportStatus.type}
          className="p-4"
        >
          <div className="flex items-start space-x-3">
            {exportStatus.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
            {exportStatus.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
            {exportStatus.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />}
            
            <div className="flex-1">
              <p className="font-medium">{exportStatus.message}</p>
              
              {exportStatus.downloadUrl && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center space-x-4 text-sm">
                    {exportStatus.fileSize && (
                      <div className="flex items-center space-x-1">
                        <HardDrive className="w-4 h-4" />
                        <span>{formatFileSize(exportStatus.fileSize)}</span>
                      </div>
                    )}
                    {exportStatus.expiresAt && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>Expira em {getExpirationTime(exportStatus.expiresAt)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      as="a"
                      href={exportStatus.downloadUrl}
                      download
                      size="sm"
                      className="flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Arquivo</span>
                    </Button>
                    <Button
                      onClick={() => setExportStatus({ type: null, message: '' })}
                      size="sm"
                      variant="outline"
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Alert>
      )}

      {/* Legal Notice */}
      <Card className="p-6 bg-gray-50">
        <div className="flex items-start space-x-3">
          <File className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="text-sm text-gray-700">
            <h4 className="font-medium mb-2">Informações Importantes</h4>
            <ul className="space-y-1">
              <li>• Os dados exportados incluem todas as informações pessoais armazenadas em nosso sistema</li>
              <li>• O download deve ser realizado dentro do prazo de 1 hora por motivos de segurança</li>
              <li>• Mantenha os arquivos exportados em local seguro e não os compartilhe</li>
              <li>• Em caso de dúvidas, entre em contato com nosso Encarregado de Proteção de Dados</li>
              <li>• Esta funcionalidade atende ao Art. 15 da LGPD (Lei 13.709/2018)</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}