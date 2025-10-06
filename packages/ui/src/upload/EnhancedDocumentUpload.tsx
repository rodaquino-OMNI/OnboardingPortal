'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Camera, FileText, CheckCircle, XCircle, Loader2, Eye, AlertTriangle, Smartphone } from 'lucide-react';

/**
 * EnhancedDocumentUpload - Pure presentation component for document uploads
 *
 * Security:
 * - Client-side only validates MIME type and size
 * - No EXIF stripping or PII handling (server responsibility)
 * - No OCR processing (server-side via pre-signed URLs)
 * - Preview rendering only (no data extraction)
 *
 * @see ADR-004: Database & Privacy - Server handles all PHI
 */

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
  onFileSelect: (file: File) => void;
  onUploadProgress?: (progress: number) => void;
  uploadStatus?: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  uploadMessage?: string;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const DEFAULT_MAX_SIZE_MB = 10;

export default function EnhancedDocumentUpload({
  documentType,
  onFileSelect,
  onUploadProgress,
  uploadStatus = 'idle',
  uploadMessage,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

    // Cleanup preview URL on unmount
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const validateFile = useCallback((selectedFile: File): string | null => {
    // MIME type validation
    if (!acceptedTypes.includes(selectedFile.type)) {
      return `Tipo de arquivo não suportado. Aceitos: ${acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`;
    }

    // Size validation (convert MB to bytes)
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      return `O arquivo deve ter no máximo ${maxSizeMB}MB`;
    }

    return null;
  }, [acceptedTypes, maxSizeMB]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const error = validateFile(selectedFile);

    if (error) {
      setValidationError(error);
      setFile(null);
      setPreview(null);
      return;
    }

    setValidationError(null);
    setFile(selectedFile);

    // Generate preview for images (NOT for PHI extraction, just UI)
    if (selectedFile.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
    } else {
      setPreview(null);
    }

    // Notify parent - parent will handle server upload
    onFileSelect(selectedFile);
  }, [validateFile, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleCameraCapture = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Document Type Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-blue-900">{documentType.name}</h3>
          {documentType.description && (
            <p className="text-sm text-blue-700 mt-1">{documentType.description}</p>
          )}
          {documentType.tips && (
            <p className="text-xs text-blue-600 mt-2 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5" />
              {documentType.tips}
            </p>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div
        className="relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="sr-only"
          id={`file-input-${documentType.id}`}
          capture={isMobile ? 'environment' : undefined}
        />

        {!file ? (
          <label
            htmlFor={`file-input-${documentType.id}`}
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-sm font-medium text-gray-700">
              Arraste o arquivo ou clique para selecionar
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} • Máx {maxSizeMB}MB
            </p>

            {isMobile && (
              <button
                type="button"
                onClick={handleCameraCapture}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Tirar Foto
              </button>
            )}
          </label>
        ) : (
          <div className="space-y-3">
            {/* File Preview */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Remover arquivo"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {preview && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-4 h-4" />
                    {showPreview ? 'Ocultar Prévia' : 'Ver Prévia'}
                  </button>
                  {showPreview && (
                    <img
                      src={preview}
                      alt="Preview"
                      className="mt-2 max-w-full h-auto rounded border border-gray-200"
                      style={{ maxHeight: '300px' }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Upload Status */}
            {uploadStatus !== 'idle' && (
              <div className="p-4 rounded-lg border"
                style={{
                  backgroundColor: uploadStatus === 'error' ? '#fef2f2' : uploadStatus === 'success' ? '#f0fdf4' : '#f9fafb',
                  borderColor: uploadStatus === 'error' ? '#fecaca' : uploadStatus === 'success' ? '#bbf7d0' : '#e5e7eb'
                }}>
                <div className="flex items-center gap-3">
                  {uploadStatus === 'uploading' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                  {uploadStatus === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                  {uploadStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {uploadStatus === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                  <p className="text-sm font-medium">{uploadMessage || 'Processando...'}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800">{validationError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
