'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Upload, FileText, ChevronLeft, ChevronRight, X, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import apiService from '@/services/api';
import { useState, useCallback } from 'react';
import { Modal, ModalTrigger, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/modal';

export default function DocumentUploadPage() {
  const router = useRouter();
  const { addPoints } = useAuth();
  
  const [uploads, setUploads] = useState<Record<string, {
    file: File | null;
    uploading: boolean;
    uploaded: boolean;
    error: string | null;
    progress: number;
    status?: 'processing' | 'approved' | 'rejected';
    rejectionReason?: string;
  }>>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExampleModal, setShowExampleModal] = useState(false);
  
  const getProgressPercentage = () => {
    const uploadedCount = Object.values(uploads).filter(u => u.uploaded).length;
    return Math.round((uploadedCount / documents.filter(d => d.required).length) * 100);
  };
  
  const getUploadedCount = () => {
    return Object.values(uploads).filter(u => u.uploaded).length;
  };
  
  const documents = [
    { id: 'rg_cnh', name: 'RG ou CNH', required: true, type: 'IDENTIFICATION' },
    { id: 'cpf', name: 'CPF', required: true, type: 'IDENTIFICATION' },
    { id: 'comprovante_residencia', name: 'Comprovante de Residência', required: true, type: 'OTHER' },
    { id: 'foto_3x4', name: 'Foto 3x4', required: true, type: 'PHOTO' },
  ];
  
  const handleFileSelect = useCallback((docId: string, file: File) => {
    setUploads(prev => ({
      ...prev,
      [docId]: {
        file,
        uploading: false,
        uploaded: false,
        error: null,
        progress: 0
      }
    }));
  }, []);
  
  const handleFileUpload = useCallback(async (docId: string) => {
    const upload = uploads[docId];
    if (!upload || !upload.file) return;
    
    setUploads(prev => ({
      ...prev,
      [docId]: { 
        ...prev[docId], 
        uploading: true, 
        error: null,
        file: prev[docId]?.file || null,
        uploaded: prev[docId]?.uploaded || false,
        progress: prev[docId]?.progress || 0
      }
    }));
    
    try {
      const response = await apiService.uploadFile(
        `/documents/upload/${docId}`,
        upload.file,
        (progress) => {
          setUploads(prev => ({
            ...prev,
            [docId]: { 
              ...prev[docId], 
              progress,
              file: prev[docId]?.file || null,
              uploading: prev[docId]?.uploading || false,
              uploaded: prev[docId]?.uploaded || false,
              error: prev[docId]?.error || null
            }
          }));
        }
      );
      
      if (response.success) {
        setUploads(prev => ({
          ...prev,
          [docId]: { 
            ...prev[docId], 
            uploading: false, 
            uploaded: true,
            file: prev[docId]?.file || null,
            progress: prev[docId]?.progress || 100,
            error: null,
            status: 'approved'
          }
        }));
        
        // Award points for document upload
        addPoints(25);
      } else {
        throw new Error(response.error?.message || 'Erro no upload');
      }
    } catch (error: unknown) {
      setUploads(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          uploading: false,
          error: error instanceof Error ? error.message : 'Erro ao fazer upload',
          file: prev[docId]?.file || null,
          uploaded: prev[docId]?.uploaded || false,
          progress: prev[docId]?.progress || 0
        }
      }));
    }
  }, [uploads, addPoints]);
  
  const handleRemoveFile = useCallback((docId: string) => {
    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[docId];
      return newUploads;
    });
  }, []);
  
  const handleDrop = useCallback((docId: string, e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file && file.size > 10 * 1024 * 1024) {
        setError('O arquivo deve ter no máximo 10MB');
        return;
      }
      if (file && !file.type.includes('image/') && !file.type.includes('pdf')) {
        setError('Apenas arquivos JPG, PNG e PDF são aceitos');
        return;
      }
      if (file) {
        handleFileSelect(docId, file);
      }
    }
  }, [handleFileSelect]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  
  const canProceed = () => {
    const requiredDocs = documents.filter(doc => doc.required);
    return requiredDocs.every(doc => uploads[doc.id]?.uploaded);
  };
  
  const handleNext = async () => {
    if (!canProceed()) {
      setError('Por favor, faça upload de todos os documentos obrigatórios.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Complete document upload step
      router.push('/interview-schedule');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Erro ao prosseguir');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBack = () => {
    router.push('/health-questionnaire');
  };
  
  return (
    <div className="max-w-2xl mx-auto" data-testid="mobile-upload-interface">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload de Documentos</h1>
            <p className="text-gray-600">Passo 4 de 4</p>
          </div>
        </div>
        <Progress value={getProgressPercentage()} className="h-2" data-testid="progress-bar" />
        <div className="mt-2 text-sm text-gray-600">
          {getProgressPercentage()}% concluído • {getUploadedCount()} de {documents.filter(d => d.required).length} documentos aprovados
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {documents.map((doc, index) => {
            const upload = uploads[doc.id];
            const hasFile = upload?.file;
            const isUploading = upload?.uploading || false;
            const isUploaded = upload?.uploaded || false;
            const hasError = upload?.error;
            
            return (
              <div 
                key={index} 
                className="border border-gray-200 rounded-lg p-4"
                data-testid={`document-section-${doc.id === 'rg_cnh' ? 'rg' : doc.id === 'comprovante_residencia' ? 'residencia' : doc.id === 'foto_3x4' ? 'foto_3x4' : doc.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">
                    {doc.name}
                    {doc.required && <span className="text-red-500 ml-1">*</span>}
                  </h3>
                  <div className="flex items-center gap-2">
                    {!doc.required && (
                      <span className="text-sm text-gray-500">Opcional</span>
                    )}
                    {isUploaded && (
                      <CheckCircle className="w-5 h-5 text-green-500" data-testid="document-status-approved" />
                    )}
                  </div>
                </div>
                
                {!hasFile ? (
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                    data-testid="drop-zone"
                    onDrop={(e) => handleDrop(doc.id, e)}
                    onDragOver={handleDragOver}
                  >
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            setError('O arquivo deve ter no máximo 10MB');
                            return;
                          }
                          if (!file.type.includes('image/') && !file.type.includes('pdf')) {
                            setError('Apenas arquivos JPG, PNG e PDF são aceitos');
                            return;
                          }
                          handleFileSelect(doc.id, file);
                        }
                      }}
                      className="hidden"
                      id={`file-${doc.id}`}
                    />
                    <label htmlFor={`file-${doc.id}`} className="cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">
                        Arraste e solte ou clique para selecionar
                      </p>
                      <p className="text-xs text-gray-500">
                        Formatos aceitos: PDF, JPG, PNG (máx. 5MB)
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {upload.file?.name}
                        </span>
                      </div>
                      {!isUploading && !isUploaded && (
                        <button
                          onClick={() => handleRemoveFile(doc.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {isUploading && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-gray-600">Processando documento...</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {hasError && (
                      <p className="text-sm text-red-600 mb-2">{hasError}</p>
                    )}
                    
                    {isUploaded && upload.status === 'approved' && (
                      <div className="mb-2">
                        <p className="text-sm text-green-600">Upload realizado com sucesso</p>
                        <p className="text-sm text-green-600">Documento aprovado</p>
                      </div>
                    )}
                    
                    {upload.status === 'rejected' && (
                      <div className="mb-2">
                        <p className="text-sm text-red-600">Documento rejeitado</p>
                        {upload.rejectionReason && (
                          <p className="text-sm text-red-600">{upload.rejectionReason}</p>
                        )}
                      </div>
                    )}
                    
                    {!isUploading && !isUploaded && (
                      <Button
                        onClick={() => handleFileUpload(doc.id)}
                        size="sm"
                        className="w-full"
                      >
                        Upload
                      </Button>
                    )}
                    
                    {isUploaded && upload.status === 'processing' && (
                      <Button
                        onClick={() => {/* Check status logic */}}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        Verificar Status
                      </Button>
                    )}
                    
                    {upload.status === 'rejected' && (
                      <Button
                        onClick={() => handleRemoveFile(doc.id)}
                        size="sm"
                        className="w-full"
                      >
                        Enviar Novo Documento
                      </Button>
                    )}
                    
                    {hasError && (
                      <Button
                        onClick={() => handleFileUpload(doc.id)}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        Tentar Novamente
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Tips Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-blue-900">Dicas para um bom upload</h4>
              <ModalTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowExampleModal(true)}
                >
                  Ver Exemplo
                </Button>
              </ModalTrigger>
              
              <Modal 
                open={showExampleModal} 
                onOpenChange={setShowExampleModal}
              >
                <ModalContent data-testid="document-example-modal">
                  <ModalHeader>
                    <ModalTitle>Exemplo de Documento</ModalTitle>
                  </ModalHeader>
                  <div className="p-4">
                    <img 
                      src="/document-example.jpg" 
                      alt="exemplo de documento válido" 
                      className="w-full rounded-lg"
                    />
                  </div>
                </ModalContent>
              </Modal>
            </div>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Mantenha a imagem nítida</li>
              <li>• Evite reflexos e sombras</li>
              <li>• Máximo 10MB por arquivo</li>
            </ul>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {canProceed() && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex flex-col gap-3">
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    ✓ Todos os documentos obrigatórios foram enviados!
                  </p>
                </div>
                <Button 
                  onClick={() => router.push('/interview-schedule')}
                  className="w-full"
                >
                  Continuar para Entrevista
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          onClick={handleNext}
          className="flex items-center gap-2"
          disabled={isLoading || !canProceed()}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Próximo
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}