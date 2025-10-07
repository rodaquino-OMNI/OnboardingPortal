/**
 * Component Tests: DocumentsContainer
 *
 * Tests the orchestration layer for document uploads
 * Coverage target: ≥90%
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DocumentsContainer } from '../DocumentsContainer';
import * as FeatureFlagProvider from '@/providers/FeatureFlagProvider';
import * as useDocumentUploadHook from '@/hooks/useDocumentUpload';
import * as analytics from '@/lib/analytics';

// Mock dependencies
jest.mock('@/providers/FeatureFlagProvider');
jest.mock('@/hooks/useDocumentUpload');
jest.mock('@/lib/analytics');
jest.mock('@repo/ui/upload/EnhancedDocumentUpload', () => ({
  __esModule: true,
  default: ({ onFileSelect, uploadStatus, uploadMessage, documentType }: any) => (
    <div data-testid="enhanced-upload">
      <p>Document Type: {documentType.name}</p>
      <p data-testid="upload-status">{uploadStatus}</p>
      <p data-testid="upload-message">{uploadMessage}</p>
      <button onClick={() => onFileSelect(new File(['test'], 'test.pdf', { type: 'application/pdf' }))}>
        Trigger Upload
      </button>
    </div>
  ),
}));

describe('DocumentsContainer', () => {
  const mockHandleUpload = jest.fn();
  const mockTrackAnalyticsEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (FeatureFlagProvider.useFeatureFlag as jest.Mock).mockReturnValue(true);
    (useDocumentUploadHook.useDocumentUpload as jest.Mock).mockReturnValue({
      handleUpload: mockHandleUpload,
      isUploading: false,
      error: null,
    });
    (analytics.trackAnalyticsEvent as jest.Mock).mockImplementation(mockTrackAnalyticsEvent);
  });

  describe('Feature Flag Behavior', () => {
    test('shows disabled message when feature flag is off', () => {
      (FeatureFlagProvider.useFeatureFlag as jest.Mock).mockReturnValue(false);

      render(<DocumentsContainer />);

      expect(screen.getByText(/not available/i)).toBeInTheDocument();
      expect(screen.queryByTestId('enhanced-upload')).not.toBeInTheDocument();
    });

    test('shows upload form when feature flag is enabled', () => {
      (FeatureFlagProvider.useFeatureFlag as jest.Mock).mockReturnValue(true);

      render(<DocumentsContainer />);

      expect(screen.getByText(/Upload Documents/i)).toBeInTheDocument();
      expect(screen.getByTestId('enhanced-upload')).toBeInTheDocument();
    });
  });

  describe('Document Type Selection', () => {
    test('renders all document type options', () => {
      render(<DocumentsContainer />);

      const select = screen.getByRole('combobox', { name: /document type/i });
      expect(select).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4); // RG, CPF, Proof of Address, Medical Certificate
      expect(screen.getByText(/RG.*Identity Card/i)).toBeInTheDocument();
      expect(screen.getByText(/CPF.*Tax ID/i)).toBeInTheDocument();
    });

    test('changes document type when user selects different option', async () => {
      render(<DocumentsContainer />);

      const select = screen.getByRole('combobox', { name: /document type/i });

      await userEvent.selectOptions(select, 'cpf');

      expect(select).toHaveValue('cpf');
      expect(screen.getByText(/CPF/)).toBeInTheDocument();
    });

    test('resets upload status when document type changes', async () => {
      render(<DocumentsContainer />);

      // Trigger an upload first
      const uploadButton = screen.getByText('Trigger Upload');
      mockHandleUpload.mockResolvedValue({ document_id: 123 });

      fireEvent.click(uploadButton);
      await waitFor(() => expect(mockHandleUpload).toHaveBeenCalled());

      // Change document type
      const select = screen.getByRole('combobox', { name: /document type/i });
      await userEvent.selectOptions(select, 'cpf');

      // Status should be reset
      const statusElement = screen.getByTestId('upload-status');
      expect(statusElement).toHaveTextContent('idle');
    });
  });

  describe('Upload Flow', () => {
    test('successful upload shows success message', async () => {
      mockHandleUpload.mockResolvedValue({ document_id: 456, status: 'pending_review' });

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-status')).toHaveTextContent('success');
      });

      expect(screen.getByTestId('upload-message')).toHaveTextContent(/successful/i);
    });

    test('failed upload shows error message', async () => {
      mockHandleUpload.mockRejectedValue(new Error('Upload failed'));

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-status')).toHaveTextContent('error');
      });

      expect(screen.getByTestId('upload-message')).toHaveTextContent(/failed/i);
    });

    test('tracks analytics events during upload', async () => {
      mockHandleUpload.mockResolvedValue({ document_id: 789 });

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
          'documents.upload_started',
          expect.objectContaining({
            document_type: 'rg',
          })
        );
      });

      await waitFor(() => {
        expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
          'documents.upload_success',
          expect.objectContaining({
            document_type: 'rg',
            document_id: 789,
          })
        );
      });
    });

    test('tracks analytics on error', async () => {
      const error = new Error('Network error');
      mockHandleUpload.mockRejectedValue(error);

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
          'documents.upload_error',
          expect.objectContaining({
            document_type: 'rg',
            error_message: 'Network error',
          })
        );
      });
    });

    test('shows uploading status during upload', async () => {
      mockHandleUpload.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ document_id: 1 }), 100)));

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      // Should show uploading immediately
      await waitFor(() => {
        expect(screen.getByTestId('upload-status')).toHaveTextContent('uploading');
      });
    });

    test('resets status after 3 seconds on success', async () => {
      jest.useFakeTimers();
      mockHandleUpload.mockResolvedValue({ document_id: 123 });

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-status')).toHaveTextContent('success');
      });

      // Fast forward 3 seconds
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.getByTestId('upload-status')).toHaveTextContent('idle');
      });

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    test('displays error from upload hook', () => {
      (useDocumentUploadHook.useDocumentUpload as jest.Mock).mockReturnValue({
        handleUpload: mockHandleUpload,
        isUploading: false,
        error: new Error('Network error'),
      });

      render(<DocumentsContainer />);

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    test('hides global error when upload-specific error is shown', async () => {
      (useDocumentUploadHook.useDocumentUpload as jest.Mock).mockReturnValue({
        handleUpload: mockHandleUpload,
        isUploading: false,
        error: new Error('Global error'),
      });

      mockHandleUpload.mockRejectedValue(new Error('Upload error'));

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-status')).toHaveTextContent('error');
      });

      // Global error should not be shown when upload error is active
      expect(screen.queryByText('Global error')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('select has proper label', () => {
      render(<DocumentsContainer />);

      const select = screen.getByRole('combobox', { name: /document type/i });
      expect(select).toHaveAccessibleName();
    });

    test('error messages are properly associated', async () => {
      mockHandleUpload.mockRejectedValue(new Error('Upload failed'));

      render(<DocumentsContainer />);

      const uploadButton = screen.getByText('Trigger Upload');
      fireEvent.click(uploadButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/failed/i);
        expect(errorMessage).toBeVisible();
      });
    });
  });
});
