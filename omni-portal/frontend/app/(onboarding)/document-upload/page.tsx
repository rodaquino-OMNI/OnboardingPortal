'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Upload, FileText, ChevronLeft, ChevronRight, X, CheckCircle, Loader2, Shield, Camera, FolderOpen, AlertCircle } from 'lucide-react';
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
      // Create form data with file and type
      const formData = new FormData();
      formData.append('file', upload.file);
      formData.append('type', docId);
      
      const response = await apiService.post(
        '/documents/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
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
          },
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
      {/* Enhanced Header */}
      <div className="mb-10">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FolderOpen className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-['Inter']">Upload de Documentos</h1>
            <p className="text-gray-600 font-['Inter'] mt-1">Passo 3 de 4</p>
          </div>
        </div>
        
        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 font-['Inter']">Armazenamento Seguro LGPD</span>
          </div>
        </div>
        
        {/* Enhanced Progress */}
        <div className="relative">
          <Progress value={getProgressPercentage()} className="h-3 bg-gray-100" data-testid="progress-bar" />
          <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-sm" style={{ width: `${getProgressPercentage()}%` }}></div>
        </div>
        <div className="mt-3 text-sm text-gray-600 font-['Inter'] text-center">
          <span className="font-semibold">{getProgressPercentage()}%</span> concluído • 
          <span className="font-semibold text-green-600"> {getUploadedCount()}</span> de 
          <span className="font-semibold">{documents.filter(d => d.required).length}</span> documentos aprovados
        </div>
      </div>

      <Card className="p-8 shadow-xl border-0 rounded-2xl bg-white">
        <div className="space-y-8">
          {documents.map((doc, index) => {
            const upload = uploads[doc.id];
            const hasFile = upload?.file;
            const isUploading = upload?.uploading || false;
            const isUploaded = upload?.uploaded || false;
            const hasError = upload?.error;
            
            return (
              <div 
                key={index} 
                className="border-2 border-gray-100 rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 hover:shadow-lg transition-all duration-300"
                data-testid={`document-section-${doc.id === 'rg_cnh' ? 'rg' : doc.id === 'comprovante_residencia' ? 'residencia' : doc.id === 'foto_3x4' ? 'foto_3x4' : doc.id}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                      {doc.type === 'PHOTO' ? <Camera className="w-5 h-5 text-blue-600" /> : <FileText className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 font-['Inter']">
                        {doc.name}
                        {doc.required && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                      <p className="text-xs text-gray-500 font-['Inter']">{doc.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!doc.required && (
                      <span className="text-sm text-gray-500 font-['Inter'] px-2 py-1 bg-gray-100 rounded-md">Opcional</span>
                    )}
                    {isUploaded && (
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-500" data-testid="document-status-approved" />
                      </div>
                    )}
                  </div>
                </div>
                
                {!hasFile ? (
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 cursor-pointer group"
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
                    <label htmlFor={`file-${doc.id}`} className="cursor-pointer block">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-base font-medium text-gray-700 mb-2 font-['Inter']">
                        Arraste e solte ou clique para selecionar
                      </p>
                      <p className="text-sm text-gray-500 font-['Inter']">
                        Formatos aceitos: PDF, JPG, PNG (máx. 10MB)
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 font-['Inter']">
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
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-sm text-gray-600 font-['Inter']">Processando documento...</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 shadow-sm"
                            style={{ width: `${upload.progress}%` }}
                          ></div>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 text-right font-['Inter']">{upload.progress}%</div>
                      </div>
                    )}
                    
                    {hasError && (
                      <p className="text-sm text-red-600 mb-2">{hasError}</p>
                    )}
                    
                    {isUploaded && upload.status === 'approved' && (
                      <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <p className="text-sm text-green-700 font-semibold font-['Inter']">Upload realizado com sucesso</p>
                        </div>
                        <p className="text-sm text-green-600 font-['Inter'] ml-6">Documento aprovado automaticamente</p>
                      </div>
                    )}
                    
                    {upload.status === 'rejected' && (
                      <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <p className="text-sm text-red-700 font-semibold font-['Inter']">Documento rejeitado</p>
                        </div>
                        {upload.rejectionReason && (
                          <p className="text-sm text-red-600 font-['Inter'] ml-6">{upload.rejectionReason}</p>
                        )}
                      </div>
                    )}
                    
                    {!isUploading && !isUploaded && (
                      <Button
                        onClick={() => handleFileUpload(doc.id)}
                        size="sm"
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all font-['Inter']"
                      >
                        Fazer Upload
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
          
          {/* Enhanced Tips Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-semibold text-blue-900 font-['Inter'] flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Dicas para um bom upload
              </h4>
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
                    <Image 
                      src="/document-example.jpg" 
                      alt="exemplo de documento válido" 
                      width={500}
                      height={300}
                      className="w-full rounded-lg"
                    />
                  </div>
                </ModalContent>
              </Modal>
            </div>
            <ul className="text-sm text-blue-800 space-y-2 font-['Inter']">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Mantenha a imagem nítida e bem iluminada
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Evite reflexos, sombras e partes cortadas
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Máximo 10MB por arquivo
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Seus dados estão protegidos com criptografia
              </li>
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
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 animate-pulse">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-base font-semibold text-green-800 font-['Inter']">
                    Todos os documentos obrigatórios foram enviados!
                  </p>
                </div>
                <Button 
                  onClick={() => router.push('/interview-schedule')}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 font-['Inter']"
                >
                  Continuar para Agendamento
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10">
        <Button
          variant="outline"
          onClick={handleBack}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 hover:bg-gray-50 transition-all font-['Inter'] group"
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </Button>
        <Button
          onClick={handleNext}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 font-['Inter'] group"
          disabled={isLoading || !canProceed()}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Próximo
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}