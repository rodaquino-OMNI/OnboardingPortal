import React from 'react';
import { AlertTriangle, RefreshCw, Upload, Info } from 'lucide-react';

interface ImageProcessingErrorProps {
  error: string;
  suggestions?: string[];
  onRetry?: () => void;
  onUploadNew?: () => void;
}

export function ImageProcessingError({ 
  error, 
  suggestions = [], 
  onRetry, 
  onUploadNew 
}: ImageProcessingErrorProps) {
  const getErrorIcon = () => {
    if (error.includes('format') || error.includes('corrupted')) {
      return <Upload className="h-8 w-8 text-red-500" />;
    }
    if (error.includes('quality') || error.includes('low')) {
      return <Info className="h-8 w-8 text-amber-500" />;
    }
    return <AlertTriangle className="h-8 w-8 text-red-500" />;
  };

  const getErrorTitle = () => {
    if (error.includes('format') || error.includes('corrupted')) {
      return 'Arquivo Inválido';
    }
    if (error.includes('quality') || error.includes('low')) {
      return 'Qualidade da Imagem';
    }
    if (error.includes('timeout') || error.includes('network')) {
      return 'Problema de Conexão';
    }
    if (error.includes('large') || error.includes('size')) {
      return 'Arquivo Muito Grande';
    }
    return 'Erro no Processamento';
  };

  const getErrorSeverity = () => {
    if (error.includes('quality') || error.includes('timeout')) {
      return 'warning';
    }
    return 'error';
  };

  const severity = getErrorSeverity();

  return (
    <div className={`
      rounded-lg border p-6 space-y-4
      ${severity === 'error' 
        ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' 
        : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
      }
    `}>
      {/* Error Header */}
      <div className="flex items-center space-x-3">
        {getErrorIcon()}
        <div>
          <h3 className={`
            font-semibold text-lg
            ${severity === 'error' ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}
          `}>
            {getErrorTitle()}
          </h3>
          <p className={`
            text-sm mt-1
            ${severity === 'error' ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}
          `}>
            {error}
          </p>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className={`
            font-medium text-sm
            ${severity === 'error' ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}
          `}>
            Como resolver:
          </h4>
          <ul className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index} className={`
                text-sm flex items-start space-x-2
                ${severity === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}
              `}>
                <span className="text-xs mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onUploadNew && (
          <button
            onClick={onUploadNew}
            className={`
              flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-colors duration-200
              ${severity === 'error'
                ? 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-600'
                : 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-700 dark:hover:bg-amber-600'
              }
            `}
          >
            <Upload className="h-4 w-4" />
            <span>Enviar Novo Arquivo</span>
          </button>
        )}
        
        {onRetry && (
          <button
            onClick={onRetry}
            className={`
              flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm
              border transition-colors duration-200
              ${severity === 'error'
                ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900'
                : 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900'
              }
            `}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Tentar Novamente</span>
          </button>
        )}
      </div>

      {/* Additional Help */}
      <div className={`
        text-xs p-3 rounded-md border-l-4
        ${severity === 'error'
          ? 'bg-red-25 border-red-400 text-red-600 dark:bg-red-900/20 dark:text-red-400'
          : 'bg-amber-25 border-amber-400 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
        }
      `}>
        <strong>Dica:</strong> Para melhores resultados, fotografe o documento em boa iluminação, 
        mantenha a câmera estável e certifique-se de que todo o documento esteja visível na foto.
      </div>
    </div>
  );
}