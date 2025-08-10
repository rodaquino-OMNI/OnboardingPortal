'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { ImageProcessingError } from './ImageProcessingError';
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
  const [isClient, setIsClient] = useState(false);
  const [processingError, setProcessingError] = useState<{
    message: string;
    suggestions: string[];
  } | null>(null);

  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  const cleanupRef = useRef<() => void>();
  
  useEffect(() => {
    setIsClient(true);
    setIsMobile(isMobileDevice);
    
    cleanupRef.current = () => {
      cancelAll();
      ocrService.terminate();
    };
    
    return () => {
      mountedRef.current = false;
      cleanupRef.current?.();
    };
  }, [isMobileDevice]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
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
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      setValidationResult({
        isValid: false,
        errors: ['O arquivo deve ter no máximo 10MB'],
        warnings: [],
        confidence: 0
      });
      return;
    }

    if (selectedFile.type.startsWith('image/')) {
      const validation = await validateImageQuality(selectedFile);
      
      if (!validation.isValid) {
        console.warn('Image quality issues:', validation.issues);
      }

      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    }

    setFile(selectedFile);
    
    if (isMobile && selectedFile.type.startsWith('image/')) {
      setTimeout(() => handleFileUpload(selectedFile), 500);
    }
  }, [isMobile]);

  const processFile = useCallback(async (
    file: File,
    signal: AbortSignal
  ): Promise<UploadResult> => {
    try {
      setProcessingError(null);

      const request = makeRequest(
        async (signal: AbortSignal) => {
          let processedFile = file;
          if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) {
            if (signal.aborted) throw new Error('Processing cancelled');
            
            if (mountedRef.current) {
              setOcrStatus('Otimizando imagem...');
            }
            
            processedFile = await compressImage(file, {
              maxWidth: 2048,
              maxHeight: 2048,
              quality: 0.9,
            });
          }

          if (signal.aborted) throw new Error('Processing cancelled');

          if (mountedRef.current) {
            setOcrStatus('Inicializando OCR...');
          }
          
          await ocrService.initialize((progress) => {
            if (mountedRef.current && !signal.aborted) {
              setOcrProgress(prev => Math.max(prev, progress.progress * 0.3));
            }
          }, signal);

          if (signal.aborted) throw new Error('Processing cancelled');

          if (mountedRef.current) {
            setOcrStatus('Processando documento...');
          }
          
          const ocrResult = await ocrService.recognizeText(
            processedFile,
            documentType.type,
            (progress) => {
              if (mountedRef.current && !signal.aborted) {
                setOcrProgress(prev => Math.max(prev, 30 + progress.progress * 0.5));
                setOcrStatus(progress.status);
              }
            },
            signal
          );

          if (signal.aborted) throw new Error('Processing cancelled');

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
        },
        { timeout: 60000 }
      );

      return await request.promise;
    } catch (error) {
      if (signal.aborted) {
        throw new Error('Processing cancelled');
      }

      console.error('File processing error:', error);
      
      let errorMessage = 'Could not process image';
      let suggestions: string[] = [];

      if (error instanceof Error) {
        errorMessage = error.message;

        if (error.message.includes('API Error: 400')) {
          try {
            const apiErrorMatch = error.message.match(/Could not process image[^"]*/);
            if (apiErrorMatch) {
              errorMessage = apiErrorMatch[0];
            }
          } catch (parseError) {
            errorMessage = 'Could not process image - please try again with a different image';
          }
        }

        if (errorMessage.includes('format') || errorMessage.includes('corrupted')) {
          suggestions = [
            'Verifique se o arquivo não está corrompido',
            'Tente salvar a imagem em formato JPEG ou PNG',
            'Fotografe o documento novamente'
          ];
        } else if (errorMessage.includes('quality') || errorMessage.includes('low')) {
          suggestions = [
            'Fotografe com melhor iluminação',
            'Mantenha o documento plano e em foco',
            'Evite sombras e reflexos no documento',
            'Use uma câmera de maior resolução se possível'
          ];
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          suggestions = [
            'Verifique sua conexão com a internet',
            'Tente novamente em alguns instantes',
            'Use uma imagem menor ou de menor qualidade'
          ];
        } else if (errorMessage.includes('large') || errorMessage.includes('size')) {
          suggestions = [
            'Comprima a imagem antes de enviar',
            'Recorte a imagem para mostrar apenas o documento',
            'Certifique-se de que o arquivo tem menos de 10MB'
          ];
        } else {
          suggestions = [
            'Tente fotografar o documento novamente',
            'Certifique-se de que há boa iluminação',
            'Entre em contato com o suporte se o problema persistir'
          ];
        }
      }

      setProcessingError({
        message: errorMessage,
        suggestions
      });

      throw new Error(errorMessage);
    }
  }, [documentType, expectedData, mountedRef]);

  const handleFileUpload = useCallback(async (selectedFile: File) => {
    try {
      setProcessingError(null);
      setOcrProgress(0);
      setOcrStatus('Iniciando processamento...');
      setIsProcessing(true);

      const result = await processFile(selectedFile, new AbortController().signal);
      
      if (result) {
        onUploadComplete(result);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setIsProcessing(false);
    }
  }, [processFile, onUploadComplete]);

  const handleRetry = useCallback(() => {
    if (file) {
      setProcessingError(null);
      setOcrProgress(0);
      setOcrStatus('');
      setValidationResult(null);
      handleFileUpload(file);
    }
  }, [file]);

  const handleUploadNew = useCallback(() => {
    setFile(null);
    setPreview(null);
    setValidationResult(null);
    setOcrProgress(0);
    setProcessingError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

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
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (fileInputRef.current) {
          fileInputRef.current.setAttribute('capture', 'environment');
          fileInputRef.current.click();
        }
      } catch (error) {
        setValidationResult({
          isValid: false,
          errors: ['Permissão de câmera negada. Por favor, habilite nas configurações do navegador.'],
          warnings: ['Você pode selecionar uma foto da galeria como alternativa.'],
          confidence: 0
        });
      }
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, []);

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
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

            {showPreview && preview && (
              <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto max-h-64 object-contain"
                />
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{ocrStatus}</span>
                  <span className="font-medium">{Math.round(ocrProgress)}%</span>
                </div>
                <Progress value={ocrProgress} className="h-2" />
              </div>
            )}

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

            {processingError && (
              <ImageProcessingError
                error={processingError.message}
                suggestions={processingError.suggestions}
                onRetry={file ? handleRetry : undefined}
                onUploadNew={handleUploadNew}
              />
            )}

            <div className="flex gap-2">
              {!isProcessing && !validationResult && isClient && (
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (file) {
                      handleFileUpload(file);
                    } else {
                      setValidationResult({
                        isValid: false,
                        errors: ['Por favor selecione um arquivo primeiro'],
                        warnings: [],
                        confidence: 0
                      });
                    }
                  }}
                  className="flex-1 min-h-[44px] bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500 shadow-md hover:shadow-lg transition-all duration-300"
                  disabled={isProcessing || !file || !isClient}
                  type="button"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {isClient ? 'Processar Documento' : 'Carregando...'}
                </Button>
              )}
              
              {!isProcessing && (
                <Button
                  variant="outline"
                  onClick={handleUploadNew}
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