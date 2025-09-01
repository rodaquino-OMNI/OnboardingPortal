'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Camera, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Eye,
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import { ocrService } from '@/lib/ocr-service';
import { compressImage, validateImageQuality } from '@/lib/image-optimizer';
import { cn } from '@/lib/utils';
import { useCancellableRequest } from '@/lib/async-utils';
import type { OCRData, DocumentValidation } from '@/types';

interface DocumentUploadProps {
  documentType: {
    id: string;
    name: string;
    required: boolean;
    type: string;
    description?: string;
    examples?: string[];
    tips?: string;
  };
  expectedData?: Record<string, string>;
  onUploadComplete: (result: UploadResult) => void;
  onUploadProgress?: (progress: number) => void;
}

interface UploadResult {
  file: File;
  ocrData?: OCRData;
  validation?: DocumentValidation;
  status: 'success' | 'error' | 'warning';
  message?: string;
}

export function EnhancedDocumentUpload({
  documentType,
  expectedData,
  onUploadComplete,
  onUploadProgress,
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { makeRequest, cancelAll } = useCancellableRequest();
  const mountedRef = useRef(true);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      cancelAll();
      // Terminate OCR service to prevent memory leaks
      ocrService.terminate();
    };
  }, [cancelAll]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    // Validate file type with proper UI feedback
    if (!selectedFile.type.match(/^image\/(jpeg|jpg|png)$/) && 
        !selectedFile.type.match(/^application\/pdf$/)) {
      setValidationResult({
        isValid: false,
        errors: ['Por favor, selecione uma imagem (JPG, PNG) ou PDF'],
        warnings: [],
        confidence: 0
      });
      return;
    }
    
    // Validate file size (10MB limit to match backend)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setValidationResult({
        isValid: false,
        errors: ['O arquivo deve ter no máximo 10MB'],
        warnings: [],
        confidence: 0
      });
      return;
    }

    // Validate and compress image
    if (selectedFile.type.startsWith('image/')) {
      const validation = await validateImageQuality(selectedFile);
      
      if (!validation.isValid) {
        console.warn('Image quality issues:', validation.issues);
      }

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    }

    setFile(selectedFile);
    
    // Auto-process on mobile for better UX
    if (isMobile && selectedFile.type.startsWith('image/')) {
      setTimeout(() => processDocument(selectedFile), 500);
    }
  }, [isMobile]);

  const processDocument = useCallback(async (fileToProcess: File) => {
    if (!mountedRef.current) return;
    
    setIsProcessing(true);
    setOcrProgress(0);
    setOcrStatus('Preparando documento...');

    const request = makeRequest(
      async (signal: AbortSignal) => {
        try {
          // Step 1: Compress image if needed
          let processedFile = fileToProcess;
          if (fileToProcess.type.startsWith('image/') && fileToProcess.size > 5 * 1024 * 1024) {
            if (signal.aborted) throw new Error('Processing cancelled');
            
            if (mountedRef.current) {
              setOcrStatus('Otimizando imagem...');
            }
            
            processedFile = await compressImage(fileToProcess, {
              maxWidth: 2048,
              maxHeight: 2048,
              quality: 0.9,
            });
          }

          if (signal.aborted) throw new Error('Processing cancelled');

          // Step 2: Initialize OCR with cancellation support
          if (mountedRef.current) {
            setOcrStatus('Inicializando OCR...');
          }
          
          await ocrService.initialize((progress) => {
            if (mountedRef.current && !signal.aborted) {
              setOcrProgress(progress.progress * 0.3); // 0-30%
            }
          }, signal);

          if (signal.aborted) throw new Error('Processing cancelled');

          // Step 3: Process OCR with cancellation support
          if (mountedRef.current) {
            setOcrStatus('Processando documento...');
          }
          
          const ocrResult = await ocrService.recognizeText(
            processedFile,
            documentType.type,
            (progress) => {
              if (mountedRef.current && !signal.aborted) {
                setOcrProgress(30 + progress.progress * 0.5); // 30-80%
                setOcrStatus(progress.status);
              }
            },
            signal
          );

          if (signal.aborted) throw new Error('Processing cancelled');

          // Step 4: Validate if expected data provided
          let validation = null;
          if (expectedData && ocrResult.extractedData) {
            if (mountedRef.current) {
              setOcrStatus('Validando dados...');
              setOcrProgress(90);
            }
            validation = await ocrService.validateDocument(ocrResult, expectedData);
            
            if (mountedRef.current && !signal.aborted) {
              setValidationResult(validation);
            }
          }

          if (signal.aborted) throw new Error('Processing cancelled');

          // Step 5: Complete
          if (mountedRef.current) {
            setOcrProgress(100);
            setOcrStatus('Processamento concluído!');
          }

          const result: UploadResult = {
            file: processedFile,
            ocrData: ocrResult,
            validation,
            status: validation?.isValid ? 'success' : validation ? 'warning' : 'success',
            message: validation?.errors?.[0] || 'Documento processado com sucesso',
          };

          return result;
        } catch (error) {
          if (signal.aborted) {
            throw new Error('Processing cancelled');
          }
          throw error;
        }
      },
      { timeout: 60000 } // 60-second timeout for document processing
    );

    try {
      const result = await request.promise;
      
      // Only update UI and call callbacks if component is still mounted and request wasn't cancelled
      if (mountedRef.current && !request.isCancelled()) {
        onUploadComplete(result);
        onUploadProgress?.(100);
      }
    } catch (error) {
      // Only handle errors if component is still mounted and request wasn't cancelled
      if (mountedRef.current && !request.isCancelled()) {
        console.error('Document processing failed:', error);
        
        // Provide specific error messages based on error type
        let errorMessage = 'Falha ao processar documento';
        let recoveryHint = '';
        
        if (error instanceof Error) {
          if (error.message.includes('cancelled')) {
            return; // Don't show error for cancelled requests
          } else if (error.message.includes('worker') || error.message.includes('OCR')) {
            errorMessage = 'Erro ao inicializar processamento de texto';
            recoveryHint = 'Tente recarregar a página e tentar novamente';
          } else if (error.message.includes('NetworkError') || error.message.includes('Load failed') || error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Erro de conexão ao carregar OCR';
            recoveryHint = 'Verifique sua conexão com a internet. O documento será enviado sem OCR.';
          } else if (error.message.includes('quality')) {
            errorMessage = 'Qualidade da imagem insuficiente';
            recoveryHint = 'Tire uma nova foto com melhor iluminação';
          }
        }
        
        setOcrStatus(errorMessage);
        setValidationResult({
          isValid: false,
          errors: [errorMessage],
          warnings: recoveryHint ? [recoveryHint] : [],
          confidence: 0
        });
        
        onUploadComplete({
          file: fileToProcess,
          status: 'error',
          message: errorMessage,
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [documentType.type, expectedData, onUploadComplete, onUploadProgress, makeRequest]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const openCamera = useCallback(async () => {
    // Check camera permissions first
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
      try {
        // Request camera permission
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        // Permission granted, proceed with camera
        if (fileInputRef.current) {
          fileInputRef.current.setAttribute('capture', 'environment');
          fileInputRef.current.click();
        }
      } catch (error) {
        // Handle permission denied or other errors
        setValidationResult({
          isValid: false,
          errors: ['Permissão de câmera negada. Por favor, habilite nas configurações do navegador.'],
          warnings: ['Você pode selecionar uma foto da galeria como alternativa.'],
          confidence: 0
        });
      }
    } else {
      // Camera not supported
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, []);

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        {/* Document Information */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {documentType.name}
                {documentType.required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              {documentType.description && (
                <p className="text-sm text-gray-600 mb-2">{documentType.description}</p>
              )}
              
              {documentType.examples && documentType.examples.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">Exemplos aceitos:</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {documentType.examples.map((example, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {documentType.tips && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <p className="text-xs text-amber-800">
                    <span className="font-medium">💡 Dica:</span> {documentType.tips}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Area */}
        {!file ? (
          <div
            data-testid="drop-zone"
            className={cn(
              "border-2 border-dashed rounded-lg p-6 sm:p-8 text-center",
              "transition-colors cursor-pointer",
              "hover:border-primary-400 hover:bg-primary-50/50",
              "dark:hover:bg-primary-950/20",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Área de upload para ${documentType.name}. Pressione Enter ou Espaço para selecionar arquivo`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) handleFileSelect(selectedFile);
              }}
              className="hidden"
            />
            
            <div className="space-y-4">
              <div className="flex justify-center gap-4">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                {isMobile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCamera();
                    }}
                    className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                    aria-label="Tirar foto com câmera"
                  >
                    <Camera className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </button>
                )}
              </div>
              
              <div>
                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {isMobile ? 'Toque para selecionar ou tirar foto' : 'Arraste ou clique para selecionar'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  JPG, PNG ou PDF (máx. 20MB)
                </p>
              </div>

              {isMobile && (
                <Alert className="text-left">
                  <Smartphone className="h-4 w-4" />
                  <AlertDescription>
                    Dica: Use a câmera para capturar o documento com melhor qualidade
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Preview */}
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="font-medium truncate">{file.name}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              
              {preview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="min-h-[44px] px-4"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {showPreview ? 'Ocultar' : 'Visualizar'}
                </Button>
              )}
            </div>

            {/* Image Preview */}
            {showPreview && preview && (
              <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto max-h-64 object-contain"
                />
              </div>
            )}

            {/* OCR Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{ocrStatus}</span>
                  <span className="font-medium">{Math.round(ocrProgress)}%</span>
                </div>
                <Progress value={ocrProgress} className="h-2" />
              </div>
            )}

            {/* Validation Results */}
            {validationResult && !isProcessing && (
              <div className="space-y-2">
                {validationResult.isValid ? (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      Documento validado com sucesso! Confiança: {validationResult.confidence}%
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {validationResult.errors.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}

                {validationResult.warnings?.length > 0 && (
                  <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription>
                      {validationResult.warnings.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!isProcessing && !validationResult && (
                <Button
                  onClick={() => processDocument(file)}
                  className="flex-1 min-h-[44px]"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Processar Documento
                </Button>
              )}
              
              {!isProcessing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setValidationResult(null);
                    setOcrProgress(0);
                  }}
                  className="min-h-[44px]"
                >
                  Trocar Arquivo
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}