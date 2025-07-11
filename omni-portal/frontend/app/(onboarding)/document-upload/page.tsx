'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Upload, FileText, ChevronLeft, ChevronRight, X, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import apiService from '@/services/api';
import { useState, useCallback } from 'react';

export default function DocumentUploadPage() {
  const router = useRouter();
  const { addPoints } = useAuth();
  
  const [uploads, setUploads] = useState<Record<string, {
    file: File | null;
    uploading: boolean;
    uploaded: boolean;
    error: string | null;
    progress: number;
  }>>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const documents = [
    { id: 'rg_cnh', name: 'RG ou CNH', required: true, type: 'IDENTIFICATION' },
    { id: 'cpf', name: 'CPF', required: true, type: 'IDENTIFICATION' },
    { id: 'comprovante_residencia', name: 'Comprovante de Residência', required: true, type: 'OTHER' },
    { id: 'certificados', name: 'Certificados', required: false, type: 'CERTIFICATION' },
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
      [docId]: { ...prev[docId], uploading: true, error: null }
    }));
    
    try {
      const response = await apiService.uploadFile(
        `/documents/upload/${docId}`,
        upload.file,
        (progress) => {
          setUploads(prev => ({
            ...prev,
            [docId]: { ...prev[docId], progress }
          }));
        }
      );
      
      if (response.success) {
        setUploads(prev => ({
          ...prev,
          [docId]: { ...prev[docId], uploading: false, uploaded: true }
        }));
        
        // Award points for document upload
        addPoints(25);
      } else {
        throw new Error(response.error?.message || 'Erro ao fazer upload');
      }
    } catch (error: unknown) {
      setUploads(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          uploading: false,
          error: error instanceof Error ? error.message : 'Erro ao fazer upload'
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Envio de Documentos</h1>
            <p className="text-gray-600">Passo 4 de 4</p>
          </div>
        </div>
        <Progress value={100} className="h-2" />
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
              <div key={index} className="border border-gray-200 rounded-lg p-4">
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
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                </div>
                
                {!hasFile ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            setError('Arquivo muito grande. Máximo 5MB.');
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
                        Clique para fazer upload ou arraste o arquivo aqui
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
                          <span className="text-sm text-gray-600">Fazendo upload...</span>
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
                    
                    {isUploaded && (
                      <p className="text-sm text-green-600 mb-2">
                        ✓ Upload concluído! Você ganhou 25 pontos!
                      </p>
                    )}
                    
                    {!isUploading && !isUploaded && (
                      <Button
                        onClick={() => handleFileUpload(doc.id)}
                        size="sm"
                        className="w-full"
                      >
                        Fazer Upload
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
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
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    ✓ Todos os documentos obrigatórios foram enviados!
                  </p>
                </div>
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