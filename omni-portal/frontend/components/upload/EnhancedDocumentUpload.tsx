"use client";

import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, File, Check, AlertCircle } from 'lucide-react';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  url?: string;
  file?: File;
}

interface EnhancedDocumentUploadProps {
  onFileUpload: (files: UploadedFile[]) => void;
  onFileRemove?: (fileId: string) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  uploadedFiles?: UploadedFile[];
  'data-testid'?: string;
}

export const EnhancedDocumentUpload: React.FC<EnhancedDocumentUploadProps> = ({
  onFileUpload,
  onFileRemove,
  acceptedFileTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  multiple = true,
  className = '',
  disabled = false,
  uploadedFiles = [],
  'data-testid': dataTestId,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `Arquivo muito grande. Máximo: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      return `Tipo de arquivo não suportado. Aceitos: ${acceptedFileTypes.join(', ')}`;
    }

    // Check max files
    if (uploadedFiles.length >= maxFiles) {
      return `Número máximo de arquivos atingido (${maxFiles})`;
    }

    return null;
  };

  const processFiles = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    const newFiles: UploadedFile[] = [];

    fileArray.forEach((file) => {
      const error = validateFile(file);
      
      const uploadedFile: UploadedFile = {
        id: generateFileId(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: error ? 'error' : 'uploading',
        progress: error ? 0 : 0,
        error,
        file,
      };

      newFiles.push(uploadedFile);

      // Simulate upload progress if no error
      if (!error) {
        setTimeout(() => {
          uploadedFile.progress = 50;
          onFileUpload([uploadedFile]);
        }, 500);

        setTimeout(() => {
          uploadedFile.progress = 100;
          uploadedFile.status = 'success';
          uploadedFile.url = URL.createObjectURL(file);
          onFileUpload([uploadedFile]);
        }, 1500);
      }
    });

    onFileUpload(newFiles);
  }, [onFileUpload, uploadedFiles.length, maxFiles, maxFileSize, acceptedFileTypes]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [processFiles]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleRemoveFile = useCallback((fileId: string) => {
    if (onFileRemove) {
      onFileRemove(fileId);
    }
  }, [onFileRemove]);

  const getFileIcon = (file: UploadedFile) => {
    if (file.status === 'success') {
      return <Check className="h-5 w-5 text-green-500" />;
    }
    if (file.status === 'error') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-gray-400" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`enhanced-document-upload ${className}`} data-testid={dataTestId}>
      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <Upload className={`mx-auto h-12 w-12 mb-4 ${
          disabled ? 'text-gray-300' : 'text-gray-400'
        }`} />
        
        <h3 className={`text-lg font-medium mb-2 ${
          disabled ? 'text-gray-400' : 'text-gray-900'
        }`}>
          {dragOver ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
        </h3>
        
        <p className={`text-sm ${disabled ? 'text-gray-300' : 'text-gray-500'}`}>
          Suporta: {acceptedFileTypes.join(', ')}
        </p>
        
        <p className={`text-xs mt-1 ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>
          Máximo: {(maxFileSize / 1024 / 1024).toFixed(1)}MB por arquivo, {maxFiles} arquivos
        </p>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptedFileTypes.join(',')}
          multiple={multiple}
          onChange={handleFileSelect}
          disabled={disabled}
        />
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Arquivos ({uploadedFiles.length}/{maxFiles})
          </h4>
          
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex-shrink-0 mr-3">
                  {getFileIcon(file)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                  
                  {file.status === 'uploading' && file.progress !== undefined && (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {file.progress}% enviado
                      </p>
                    </div>
                  )}
                  
                  {file.status === 'error' && file.error && (
                    <p className="text-xs text-red-500 mt-1">{file.error}</p>
                  )}
                </div>
                
                {onFileRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(file.id);
                    }}
                    className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-gray-600"
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedDocumentUpload;