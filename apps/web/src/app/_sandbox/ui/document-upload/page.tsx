'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, TestTube, FileText, Upload } from 'lucide-react';
import EnhancedDocumentUpload from '@onboarding-portal/ui/upload/EnhancedDocumentUpload';

// Mock document types for sandbox testing
const documentTypes = [
  {
    id: 'id-document',
    name: 'Documento de Identidade',
    required: true,
    type: 'identification',
    description: 'RG, CNH ou Passaporte brasileiro válido',
    examples: ['RG frente e verso', 'CNH válida', 'Passaporte brasileiro'],
    tips: 'Certifique-se de que todos os dados estão legíveis e a foto está nítida',
  },
  {
    id: 'medical-records',
    name: 'Histórico Médico',
    required: false,
    type: 'medical',
    description: 'Relatórios médicos, exames ou prescrições recentes',
    examples: ['Relatórios de consulta', 'Resultados de exames', 'Receitas médicas'],
    tips: 'Documentos dos últimos 6 meses são mais relevantes',
  },
  {
    id: 'insurance-card',
    name: 'Cartão do Plano de Saúde',
    required: true,
    type: 'insurance',
    description: 'Cartão ou documento do seu plano de saúde',
    examples: ['Carteirinha do plano', 'Documento de cobertura'],
    tips: 'Verifique se o plano está ativo e dentro da validade',
  },
];

export default function DocumentUploadSandbox() {
  const [currentDocType, setCurrentDocType] = useState(documentTypes[0]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (file: File) => {
    console.log('File selected:', file.name, file.size, file.type);

    // Simulate upload process
    setUploadStatus('uploading');
    setUploadMessage('Fazendo upload do arquivo...');
    setUploadProgress(0);

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setUploadStatus('processing');
          setUploadMessage('Processando documento com OCR...');

          // Simulate processing
          setTimeout(() => {
            const success = Math.random() > 0.2; // 80% success rate
            if (success) {
              setUploadStatus('success');
              setUploadMessage('Documento processado com sucesso! OCR completado.');
            } else {
              setUploadStatus('error');
              setUploadMessage('Erro no processamento. Verifique se o documento está legível.');
            }
          }, 2000);

          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const resetDemo = () => {
    setUploadStatus('idle');
    setUploadMessage('');
    setUploadProgress(0);
  };

  const simulateError = () => {
    setUploadStatus('error');
    setUploadMessage('Arquivo muito grande. Reduza o tamanho para menos de 10MB.');
  };

  const simulateSuccess = () => {
    setUploadStatus('success');
    setUploadMessage('Upload concluído! Documento validado e armazenado com segurança.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/ui"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sandbox
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">EnhancedDocumentUpload Component</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={simulateError}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Simulate Error
          </button>
          <button
            onClick={simulateSuccess}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            Simulate Success
          </button>
          <button
            onClick={resetDemo}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Demo
          </button>
        </div>
      </div>

      {/* Component Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Component Features</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Upload Features</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• Drag & drop file upload</li>
              <li>• Mobile camera capture</li>
              <li>• File type validation (JPEG, PNG, PDF)</li>
              <li>• File size limits (configurable)</li>
              <li>• Image preview generation</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Security & Privacy</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• Client-side validation only</li>
              <li>• No EXIF stripping (server-side)</li>
              <li>• Preview-only rendering</li>
              <li>• Secure file handling</li>
              <li>• Privacy-compliant design</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Document Type Selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Type Selector</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {documentTypes.map((docType) => (
            <button
              key={docType.id}
              onClick={() => {
                setCurrentDocType(docType);
                resetDemo();
              }}
              className={`p-4 border rounded-lg text-left transition-all ${
                currentDocType.id === docType.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText className={`w-5 h-5 ${
                  currentDocType.id === docType.id ? 'text-blue-600' : 'text-gray-500'
                }`} />
                <h3 className="font-medium text-gray-900">{docType.name}</h3>
              </div>
              <p className="text-sm text-gray-600">{docType.description}</p>
              {docType.required && (
                <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  Obrigatório
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live Component Demo */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Live Component Demo</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload component with real file handling and progress simulation
          </p>
        </div>

        <div className="p-6">
          <EnhancedDocumentUpload
            documentType={currentDocType}
            onFileSelect={handleFileSelect}
            onUploadProgress={setUploadProgress}
            uploadStatus={uploadStatus}
            uploadMessage={uploadMessage}
            maxSizeMB={10}
            acceptedTypes={['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']}
          />
        </div>
      </div>

      {/* Upload Progress (when active) */}
      {uploadStatus === 'uploading' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-4">Upload Progress</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progresso do upload</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* File Type Testing */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Supported File Types</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          {[
            { type: 'JPEG', desc: 'image/jpeg', color: 'green' },
            { type: 'PNG', desc: 'image/png', color: 'blue' },
            { type: 'PDF', desc: 'application/pdf', color: 'red' },
            { type: 'Invalid', desc: 'Other types rejected', color: 'gray' },
          ].map((fileType) => (
            <div
              key={fileType.type}
              className={`p-3 border rounded-lg ${
                fileType.color === 'green' ? 'border-green-200 bg-green-50' :
                fileType.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                fileType.color === 'red' ? 'border-red-200 bg-red-50' :
                'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">{fileType.type}</div>
              <div className="text-gray-600 text-xs">{fileType.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Accessibility Notes */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2">Accessibility Features</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Screen reader labels for upload areas</li>
          <li>• Keyboard navigation for file selection</li>
          <li>• ARIA live regions for upload status</li>
          <li>• High contrast validation messages</li>
          <li>• Focus management for file inputs</li>
          <li>• Descriptive error announcements</li>
        </ul>
      </div>
    </div>
  );
}