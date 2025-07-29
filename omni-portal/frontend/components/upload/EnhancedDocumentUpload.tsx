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
import type { OCRData, DocumentValidation } from '@/types';

interface DocumentUploadProps {
  documentType: {
    id: string;
    name: string;
    required: boolean;
    type: string;
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

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.type.match(/^image\/(jpeg|jpg|png)$/) && 
        !selectedFile.type.match(/^application\/pdf$/)) {
      alert('Por favor, selecione uma imagem (JPG, PNG) ou PDF');
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
    setIsProcessing(true);
    setOcrProgress(0);
    setOcrStatus('Preparando documento...');

    try {
      // Step 1: Compress image if needed
      let processedFile = fileToProcess;
      if (fileToProcess.type.startsWith('image/') && fileToProcess.size > 5 * 1024 * 1024) {
        setOcrStatus('Otimizando imagem...');
        processedFile = await compressImage(fileToProcess, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.9,
        });
      }

      // Step 2: Initialize OCR
      setOcrStatus('Inicializando OCR...');
      await ocrService.initialize((progress) => {
        setOcrProgress(progress.progress * 0.3); // 0-30%
      });

      // Step 3: Process OCR
      setOcrStatus('Processando documento...');
      const ocrResult = await ocrService.recognizeText(
        processedFile,
        documentType.type,
        (progress) => {
          setOcrProgress(30 + progress.progress * 0.5); // 30-80%
          setOcrStatus(progress.status);
        }
      );

      // Step 4: Validate if expected data provided
      let validation = null;
      if (expectedData && ocrResult.extractedData) {
        setOcrStatus('Validando dados...');
        validation = await ocrService.validateDocument(ocrResult, expectedData);
        setValidationResult(validation);
        setOcrProgress(90);
      }

      // Step 5: Complete
      setOcrProgress(100);
      setOcrStatus('Processamento concluído!');

      const result: UploadResult = {
        file: processedFile,
        ocrData: ocrResult,
        validation,
        status: validation?.isValid ? 'success' : validation ? 'warning' : 'success',
        message: validation?.errors?.[0] || 'Documento processado com sucesso',
      };

      onUploadComplete(result);
      onUploadProgress?.(100);

    } catch (error) {
      console.error('Document processing failed:', error);
      setOcrStatus('Erro no processamento');
      
      onUploadComplete({
        file: fileToProcess,
        status: 'error',
        message: 'Falha ao processar documento',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [documentType.type, expectedData, onUploadComplete, onUploadProgress]);

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

  const openCamera = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  }, []);

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        {/* Upload Area */}
        {!file ? (
          <div
            data-testid="drop-zone"
            className={cn(
              "border-2 border-dashed rounded-lg p-6 sm:p-8 text-center",
              "transition-colors cursor-pointer",
              "hover:border-primary-400 hover:bg-primary-50/50",
              "dark:hover:bg-primary-950/20"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
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
                    className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center"
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
                  className="flex-1"
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