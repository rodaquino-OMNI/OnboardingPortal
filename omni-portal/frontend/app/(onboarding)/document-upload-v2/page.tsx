'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EnhancedDocumentUpload } from '@/components/upload/EnhancedDocumentUpload';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import apiService from '@/services/api';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  Info,
  Loader2
} from 'lucide-react';

interface DocumentStatus {
  uploaded: boolean;
  processing: boolean;
  validated: boolean;
  error?: string;
  ocrData?: { text: string; confidence: number; fields: unknown[] };
  file?: File;
}

export default function EnhancedDocumentUploadPage() {
  const router = useRouter();
  const { user, addPoints } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, DocumentStatus>>({});

  const documents = [
    { 
      id: 'rg_cnh', 
      name: 'RG ou CNH', 
      required: true, 
      type: 'IDENTIFICATION',
      expectedData: user?.beneficiary ? {
        name: user.beneficiary.full_name,
        birthDate: user.beneficiary.birth_date,
      } : undefined
    },
    { 
      id: 'cpf', 
      name: 'CPF', 
      required: true, 
      type: 'IDENTIFICATION',
      expectedData: user?.beneficiary ? {
        cpf: user.beneficiary.cpf,
        name: user.beneficiary.full_name,
      } : undefined
    },
    { 
      id: 'comprovante_residencia', 
      name: 'Comprovante de Residência', 
      required: true, 
      type: 'ADDRESS_PROOF',
      expectedData: user?.beneficiary?.address ? {
        cep: user.beneficiary.address.cep,
        street: user.beneficiary.address.street,
        city: user.beneficiary.address.city,
      } : undefined
    },
    { 
      id: 'foto_3x4', 
      name: 'Foto 3x4', 
      required: true, 
      type: 'PHOTO',
      expectedData: undefined
    },
  ];

  const getProgress = () => {
    const uploaded = Object.values(documentStatuses).filter(s => s.uploaded && s.validated).length;
    return Math.round((uploaded / documents.length) * 100);
  };

  const canProceed = () => {
    return documents.every(doc => {
      const status = documentStatuses[doc.id];
      return status?.uploaded && status?.validated && !status?.error;
    });
  };

  const handleDocumentUpload = async (docId: string, result: any) => {
    setDocumentStatuses(prev => ({
      ...prev,
      [docId]: {
        uploaded: false,
        processing: true,
        validated: false,
        ...prev[docId],
      }
    }));

    try {
      // Upload to server with OCR data
      const formData = new FormData();
      formData.append('file', result.file);
      formData.append('type', docId);
      formData.append('ocr_data', JSON.stringify(result.ocrData));
      formData.append('validation', JSON.stringify(result.validation));

      const response = await apiService.post(`/documents/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.success) {
        setDocumentStatuses(prev => ({
          ...prev,
          [docId]: {
            uploaded: true,
            processing: false,
            validated: result.validation?.isValid ?? true,
            ocrData: result.ocrData,
            file: result.file,
          }
        }));

        // Award points
        addPoints(25);

        // Auto-advance to next document on mobile
        if (window.innerWidth < 768 && currentStep < documents.length - 1) {
          setTimeout(() => setCurrentStep(currentStep + 1), 1000);
        }
      }
    } catch {
      setDocumentStatuses(prev => ({
        ...prev,
        [docId]: {
          uploaded: false,
          processing: false,
          validated: false,
          error: 'Erro ao enviar documento',
          ...prev[docId],
        }
      }));
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      alert('Por favor, envie todos os documentos obrigatórios');
      return;
    }

    setIsLoading(true);
    try {
      // Navigate to next step
      router.push('/interview-schedule');
    } catch (error) {
      console.error('Error proceeding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Header */}
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
        
        <Progress value={getProgress()} className="h-2" />
        <p className="text-sm text-gray-600 mt-2">
          {getProgress()}% concluído • {Object.values(documentStatuses).filter(s => s.uploaded).length} de {documents.length} documentos
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Nosso sistema usa OCR para ler seus documentos automaticamente. 
          Certifique-se de que as imagens estejam nítidas e bem iluminadas.
        </AlertDescription>
      </Alert>

      {/* Document Upload Interface */}
      {isMobile ? (
        // Mobile: Show one document at a time
        <div className="space-y-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {documents[currentStep]?.name || 'Document'}
                {documents[currentStep]?.required && <span className="text-red-500 ml-1">*</span>}
              </h2>
              <span className="text-sm text-gray-500">
                {currentStep + 1} de {documents.length}
              </span>
            </div>
          </div>

          {documents[currentStep] && (
            <EnhancedDocumentUpload
              documentType={documents[currentStep]}
              expectedData={documents[currentStep].expectedData || {}}
              onUploadComplete={(result) => handleDocumentUpload(documents[currentStep]?.id || '', result)}
            />
          )}

          {/* Mobile Navigation */}
          <div className="flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            
            {currentStep < documents.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!documentStatuses[documents[currentStep]?.id || '']?.uploaded}
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Finalizar
                    <CheckCircle2 className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Desktop: Show all documents
        <div className="space-y-6">
          {documents.map((doc) => {
            const status = documentStatuses[doc.id];
            
            return (
              <div key={doc.id} className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">
                    {doc.name}
                    {doc.required && <span className="text-red-500 ml-1">*</span>}
                  </h3>
                  {status?.uploaded && status?.validated && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                </div>
                
                <EnhancedDocumentUpload
                  documentType={doc}
                  expectedData={doc.expectedData || {}}
                  onUploadComplete={(result) => handleDocumentUpload(doc.id, result)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Success Message */}
      {canProceed() && !isMobile && (
        <Alert className="mt-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Todos os documentos foram enviados e validados com sucesso!
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation Buttons (Desktop) */}
      {!isMobile && (
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => router.push('/health-questionnaire')}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Próximo
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}