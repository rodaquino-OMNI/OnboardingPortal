/**
 * Documents Container - Orchestration layer for document upload
 *
 * Responsibilities:
 * - Feature flag checking
 * - Upload orchestration via useDocumentUpload hook
 * - State management
 * - Error handling
 * - Analytics tracking
 *
 * ADR-003 Compliant: NO network calls in UI package
 */

'use client';

import React, { useState } from 'react';
import EnhancedDocumentUpload from '@repo/ui/upload/EnhancedDocumentUpload';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { useFeatureFlag } from '@/providers/FeatureFlagProvider';
import { trackAnalyticsEvent } from '@/lib/analytics';

// Document types configuration
const DOCUMENT_TYPES = [
  {
    id: 'rg',
    name: 'RG (Identity Card)',
    type: 'rg',
    required: true,
    description: 'Upload the front and back of your Identity Card',
    tips: 'Make sure all information is clearly visible',
  },
  {
    id: 'cpf',
    name: 'CPF (Tax ID)',
    type: 'cpf',
    required: true,
    description: 'Upload your CPF document',
    tips: 'Ensure the CPF number is legible',
  },
  {
    id: 'proof_of_address',
    name: 'Proof of Address',
    type: 'proof_of_address',
    required: false,
    description: 'Upload a recent utility bill or bank statement',
    tips: 'Document must be less than 3 months old',
  },
  {
    id: 'medical_certificate',
    name: 'Medical Certificate',
    type: 'medical_certificate',
    required: false,
    description: 'Upload your medical certificate if applicable',
    tips: 'Must be signed by a licensed healthcare provider',
  },
];

export function DocumentsContainer() {
  const isEnabled = useFeatureFlag('sliceB_documents');
  const { handleUpload, isUploading, error } = useDocumentUpload();
  const [selectedType, setSelectedType] = useState<string>('rg');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('');

  const currentDocumentType = DOCUMENT_TYPES.find(dt => dt.type === selectedType) || DOCUMENT_TYPES[0];

  if (!isEnabled) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">
            Feature Not Available
          </h2>
          <p className="text-yellow-800">
            Document upload is currently not available for your account. Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const handleFileSelect = async (file: File) => {
    setUploadStatus('uploading');
    setUploadMessage('Preparing upload...');

    try {
      // Track start
      await trackAnalyticsEvent('documents.upload_started', {
        document_type: selectedType,
        file_size: file.size,
      });

      setUploadMessage('Uploading to storage...');
      const result = await handleUpload(file, selectedType);

      setUploadStatus('success');
      setUploadMessage('Upload successful! Your document is being processed.');

      // Track success
      await trackAnalyticsEvent('documents.upload_success', {
        document_type: selectedType,
        document_id: result.document_id,
      });

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadMessage('');
      }, 3000);
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');

      // Track error
      await trackAnalyticsEvent('documents.upload_error', {
        document_type: selectedType,
        error_message: err instanceof Error ? err.message : 'Unknown error',
      });

      console.error('Upload failed:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Documents</h1>
        <p className="text-gray-600">
          Please upload the required documents to complete your onboarding process.
        </p>
      </div>

      {/* Document Type Selector */}
      <div className="space-y-2">
        <label htmlFor="document-type" className="block text-sm font-medium text-gray-700">
          Document Type
        </label>
        <select
          id="document-type"
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setUploadStatus('idle');
            setUploadMessage('');
          }}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {DOCUMENT_TYPES.map((docType) => (
            <option key={docType.id} value={docType.type}>
              {docType.name} {docType.required ? '(Required)' : '(Optional)'}
            </option>
          ))}
        </select>
      </div>

      {/* Upload Component */}
      <EnhancedDocumentUpload
        documentType={currentDocumentType}
        onFileSelect={handleFileSelect}
        uploadStatus={uploadStatus}
        uploadMessage={uploadMessage}
        maxSizeMB={10}
        acceptedTypes={['application/pdf', 'image/jpeg', 'image/png']}
      />

      {/* Global Error Display */}
      {error && uploadStatus !== 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error.message}</p>
        </div>
      )}
    </div>
  );
}
