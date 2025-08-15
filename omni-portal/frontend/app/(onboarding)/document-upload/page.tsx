'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Shield, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import apiService from '@/services/api';
import { EnhancedDocumentUpload } from '@/components/upload/EnhancedDocumentUpload';
import type { OCRData, DocumentValidation } from '@/types';

interface UploadState {
  file: File | null;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
  progress: number;
  status?: 'processing' | 'approved' | 'rejected';
  rejectionReason?: string;
  ocrData?: OCRData;
  validation?: DocumentValidation;
}

interface UploadResult {
  file: File;
  ocrData?: OCRData;
  validation?: DocumentValidation;
  status: 'success' | 'error' | 'warning';
  message?: string;
}

export default function DocumentUploadPage() {
  const router = useRouter();
  // Points are awarded by backend only - removed client-side awarding for security
  
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documents = useMemo(() => [
    { 
      id: 'rg_cnh', 
      name: 'RG ou CNH', 
      required: true, 
      type: 'identity',
      description: 'Documento de identificação com foto',
      examples: ['RG (Registro Geral)', 'CNH (Carteira Nacional de Habilitação)', 'RNE (Registro Nacional de Estrangeiro)'],
      tips: 'Certifique-se que a foto e dados estejam legíveis'
    },
    { 
      id: 'cpf', 
      name: 'CPF', 
      required: true, 
      type: 'identity',
      description: 'Comprovante do Cadastro de Pessoa Física',
      examples: ['Cartão CPF', 'Comprovante de inscrição no CPF', 'Certidão de nascimento ou casamento com CPF'],
      tips: 'O número do CPF deve estar claramente visível'
    },
    { 
      id: 'comprovante_residencia', 
      name: 'Comprovante de Residência', 
      required: true, 
      type: 'proof_of_address',
      description: 'Documento que comprove seu endereço atual',
      examples: ['Conta de luz, água ou gás', 'Fatura de telefone ou internet', 'Extrato bancário', 'Contrato de aluguel'],
      tips: 'Documento deve ser dos últimos 3 meses e conter seu nome e endereço completo'
    },
    { 
      id: 'foto_3x4', 
      name: 'Foto 3x4', 
      required: true, 
      type: 'photo',
      description: 'Foto recente tipo documento',
      examples: ['Foto 3x4 impressa', 'Foto digital em boa qualidade'],
      tips: 'Fundo claro, rosto descoberto, sem óculos escuros. Use a câmera para melhor qualidade'
    }
  ], []);

  const getProgressPercentage = () => {
    const uploadedCount = Object.values(uploads).filter(u => u.uploaded).length;
    return Math.round((uploadedCount / documents.filter(d => d.required).length) * 100);
  };
  
  const getUploadedCount = () => {
    return Object.values(uploads).filter(u => u.uploaded).length;
  };

  const handleEnhancedUploadComplete = useCallback(async (docId: string, result: UploadResult) => {
    if (result.status === 'success' || result.status === 'warning') {
      // Update local state immediately for better UX
      setUploads(prev => ({
        ...prev,
        [docId]: {
          file: result.file,
          uploading: true,
          uploaded: false,
          error: null,
          progress: 80,
          ...(result.ocrData && { ocrData: result.ocrData }),
          ...(result.validation && { validation: result.validation })
        }
      }));

      try {
        // Upload to backend with OCR data
        const formData = new FormData();
        formData.append('file', result.file);
        formData.append('type', docId);
        
        // Include OCR data if available (backend supports it)
        if (result.ocrData) {
          formData.append('ocr_data', JSON.stringify({
            text: result.ocrData.text,
            confidence: result.ocrData.confidence,
            extractedFields: result.ocrData.extractedFields
          }));
        }
        
        // Include validation if available
        if (result.validation) {
          formData.append('validation', JSON.stringify(result.validation));
        }

        // Use V2 endpoint for OCR support
        const response = await apiService.post('/v2/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.success) {
          setUploads(prev => ({
            ...prev,
            [docId]: {
              file: prev[docId]?.file || null,
              error: prev[docId]?.error || null,
              uploading: false,
              uploaded: true,
              progress: 100,
              status: 'approved' as const,
              ...(prev[docId]?.ocrData && { ocrData: prev[docId]?.ocrData }),
              ...(prev[docId]?.validation && { validation: prev[docId]?.validation })
            } as UploadState
          }));
          
          // Points are automatically awarded by the backend:
          // - 25 points for document upload
          // - 50 bonus points for successful OCR validation
          // The backend handles all gamification logic for security
          
          const pointsAwarded = result.ocrData && result.validation?.isValid ? 75 : 25;
          console.log(`✨ Backend awarded ${pointsAwarded} points for document upload`);

          // Check for milestone achievements (display only - backend handles rewards)
          const currentUploads = Object.values(uploads).filter(u => u.uploaded).length + 1; // +1 for current upload
          const totalRequired = documents.filter(d => d.required).length;
          
          // Display milestone notifications (backend handles the actual rewards)
          if (currentUploads === Math.ceil(totalRequired / 2)) {
            // Halfway milestone
            console.log('🎉 Halfway milestone reached! Backend will award bonus points.');
          } else if (currentUploads === totalRequired) {
            // Completion milestone
            console.log('🏆 All documents completed! Backend will award completion bonus.');
          }
        } else {
          throw new Error(response.error?.message || 'Erro no upload');
        }
      } catch (error) {
        setUploads(prev => ({
          ...prev,
          [docId]: {
            file: prev[docId]?.file || null,
            uploaded: prev[docId]?.uploaded || false,
            uploading: false,
            error: error instanceof Error ? error.message : 'Erro ao fazer upload',
            progress: 0,
            ...(prev[docId]?.ocrData && { ocrData: prev[docId]?.ocrData }),
            ...(prev[docId]?.validation && { validation: prev[docId]?.validation }),
            ...(prev[docId]?.status && { status: prev[docId]?.status }),
            ...(prev[docId]?.rejectionReason && { rejectionReason: prev[docId]?.rejectionReason })
          } as UploadState
        }));
      }
    } else {
      // Handle error case
      setUploads(prev => ({
        ...prev,
        [docId]: {
          file: result.file,
          uploading: false,
          uploaded: false,
          error: result.message || 'Erro no processamento',
          progress: 0,
          ...(result.ocrData && { ocrData: result.ocrData }),
          ...(result.validation && { validation: result.validation })
        } as UploadState
      }));
    }
  }, [documents, uploads]);

  const handleEnhancedUploadProgress = useCallback((docId: string, progress: number) => {
    setUploads(prev => ({
      ...prev,
      [docId]: {
        file: prev[docId]?.file || null,
        uploaded: prev[docId]?.uploaded || false,
        error: prev[docId]?.error || null,
        progress: Math.min(progress * 0.8, 80), // Reserve 20% for backend upload
        uploading: progress > 0 && progress < 100,
        ...(prev[docId]?.ocrData && { ocrData: prev[docId]?.ocrData }),
        ...(prev[docId]?.validation && { validation: prev[docId]?.validation }),
        ...(prev[docId]?.status && { status: prev[docId]?.status }),
        ...(prev[docId]?.rejectionReason && { rejectionReason: prev[docId]?.rejectionReason })
      } as UploadState
    }));
  }, []);

  const canProceed = () => {
    // Allow progression with partial uploads - non-blocking UX
    return true;
  };

  const getCompletionStats = () => {
    const requiredDocs = documents.filter(doc => doc.required);
    const completedDocs = requiredDocs.filter(doc => uploads[doc.id]?.uploaded);
    const pendingDocs = requiredDocs.filter(doc => !uploads[doc.id]?.uploaded);
    
    return {
      total: requiredDocs.length,
      completed: completedDocs.length,
      pending: pendingDocs.length,
      completedDocs,
      pendingDocs,
      isComplete: completedDocs.length === requiredDocs.length,
      completionPercentage: Math.round((completedDocs.length / requiredDocs.length) * 100)
    };
  };
  
  const handleNext = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const stats = getCompletionStats();
      
      // Save partial progress to localStorage for reminder system
      const partialProgress = {
        documentUploads: uploads,
        completionStats: stats,
        timestamp: Date.now(),
        step: 'document-upload'
      };
      
      localStorage.setItem('onboarding_partial_progress', JSON.stringify(partialProgress));
      
      // Points are already awarded per upload, no need to duplicate here
      
      // Navigate to next step regardless of completion status
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4" data-testid="mobile-upload-interface">
        {/* Enhanced Header */}
        <div className="mb-10">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Upload de Documentos</h1>
              <p className="text-gray-600 mt-1">Passo 3 de 4</p>
            </div>
          </div>
          
          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="px-4 py-2 bg-blue-50 rounded-full flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Armazenamento Seguro LGPD</span>
            </div>
          </div>
          
          {/* Enhanced Progress */}
          <div className="relative">
            <Progress value={getProgressPercentage()} className="h-3 bg-gray-200" data-testid="progress-bar" />
            <div className="absolute top-0 left-0 h-full bg-blue-600 rounded-full shadow-sm transition-all duration-300" style={{ width: `${getProgressPercentage()}%` }}></div>
          </div>
          <div className="mt-3 text-sm text-gray-600 text-center">
            <span className="font-semibold">{getProgressPercentage()}%</span> concluído • 
            <span className="font-semibold text-blue-600"> {getUploadedCount()}</span> de 
            <span className="font-semibold">{documents.filter(d => d.required).length}</span> documentos enviados
            {getUploadedCount() < documents.filter(d => d.required).length && (
              <div className="mt-1 text-amber-600 font-medium">
                📋 {documents.filter(d => d.required).length - getUploadedCount()} documento(s) pendente(s)
              </div>
            )}
          </div>
        </div>

        <Card className="card-modern p-8">
          <div className="space-y-8">
            {documents.map((doc, index) => {
              const upload = uploads[doc.id];
              const isUploaded = upload?.uploaded || false;
              
              return (
                <div 
                  key={index} 
                  className="border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200"
                  data-testid={`document-section-${doc.id === 'rg_cnh' ? 'rg' : doc.id === 'comprovante_residencia' ? 'residencia' : doc.id === 'foto_3x4' ? 'foto_3x4' : doc.id}`}
                >
                  {isUploaded ? (
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {doc.name}
                              {doc.required && <span className="text-red-500 ml-1">*</span>}
                            </h3>
                            <p className="text-sm text-green-600">Documento enviado com sucesso</p>
                          </div>
                        </div>
                      </div>
                      {upload?.ocrData && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-700 font-medium">OCR processado com {Math.round(upload.ocrData.confidence)}% de confiança</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <EnhancedDocumentUpload
                      documentType={doc}
                      onUploadComplete={(result) => handleEnhancedUploadComplete(doc.id, result)}
                      onUploadProgress={(progress) => handleEnhancedUploadProgress(doc.id, progress)}
                    />
                  )}
                </div>
              );
            })}
          
          {/* Enhanced Tips Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5" />
              Recursos avançados de upload
            </h4>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <strong>OCR automático:</strong> Extração de texto dos documentos
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <strong>Câmera mobile:</strong> Capture direto pelo celular
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <strong>Validação em tempo real:</strong> Verificação instantânea
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <strong>Compressão inteligente:</strong> Reduz tamanho em até 80%
              </li>
            </ul>
          </div>
          
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Progress Summary & Next Steps */}
          <div className={`rounded-xl p-6 border ${
            getCompletionStats().isComplete 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 animate-pulse' 
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
          }`}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  getCompletionStats().isComplete 
                    ? 'bg-green-100' 
                    : 'bg-blue-100'
                }`}>
                  {getCompletionStats().isComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {getCompletionStats().completed}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  {getCompletionStats().isComplete ? (
                    <p className="text-base font-semibold text-green-800">
                      ✅ Todos os documentos foram enviados!
                    </p>
                  ) : (
                    <div>
                      <p className="text-base font-semibold text-blue-800">
                        📄 {getCompletionStats().completed} de {getCompletionStats().total} documentos enviados
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        Você pode continuar e finalizar os uploads depois
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Pending Documents Reminder */}
              {!getCompletionStats().isComplete && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800 mb-2">📋 Documentos pendentes:</p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    {getCompletionStats().pendingDocs.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                        {doc.name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 mt-2 font-medium">
                    💡 Lembre-se de completar estes uploads para finalizar seu cadastro!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10">
        <Button
          variant="outline"
          onClick={handleBack}
          className="flex flex-col items-center gap-1 px-6 py-3 min-h-[56px] rounded-xl border-2 hover:bg-gray-50 transition-all group"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Voltar</span>
          </div>
          <span className="text-xs text-gray-500">Questionário de Saúde</span>
        </Button>
        <Button
          onClick={handleNext}
          className="flex flex-col items-center gap-1 px-6 py-3 min-h-[56px] bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 group"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span>{getCompletionStats().isComplete ? 'Continuar' : 'Prosseguir'}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
              <span className="text-xs text-white/90">Agendar Entrevista</span>
            </>
          )}
        </Button>
      </div>
    </div>
    </div>
  );
}