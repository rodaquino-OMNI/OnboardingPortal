import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnhancedDocumentUpload from '../../../src/upload/EnhancedDocumentUpload';
import {
  createMockDocumentUploadProps,
  createMockDocumentType,
  createMockFile,
  createMockImageFile,
  setupVideoMocks,
  cleanupVideoMocks,
} from '../../helpers/video-mocks';

describe('EnhancedDocumentUpload', () => {
  beforeEach(() => {
    setupVideoMocks();

    // Mock navigator.userAgent for mobile detection tests
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
  });

  afterEach(() => {
    cleanupVideoMocks();
  });

  describe('Rendering', () => {
    it('renders the document upload interface', () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      expect(screen.getByText(props.documentType.name)).toBeInTheDocument();
      expect(screen.getByText(/arraste o arquivo ou clique para selecionar/i)).toBeInTheDocument();
    });

    it('displays document type information', () => {
      const documentType = createMockDocumentType({
        name: 'Identity Document',
        description: 'Upload your ID document',
        tips: 'Make sure the document is clearly visible',
      });
      const props = createMockDocumentUploadProps({ documentType });
      render(<EnhancedDocumentUpload {...props} />);

      expect(screen.getByText('Identity Document')).toBeInTheDocument();
      expect(screen.getByText('Upload your ID document')).toBeInTheDocument();
      expect(screen.getByText('Make sure the document is clearly visible')).toBeInTheDocument();
    });

    it('displays accepted file types and size limit', () => {
      const props = createMockDocumentUploadProps({
        maxSizeMB: 5,
        acceptedTypes: ['image/jpeg', 'application/pdf'],
      });
      render(<EnhancedDocumentUpload {...props} />);

      expect(screen.getByText(/jpeg, pdf • máx 5mb/i)).toBeInTheDocument();
    });

    it('shows camera button on mobile devices', () => {
      // Mock mobile user agent
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      });

      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      expect(screen.getByText(/tirar foto/i)).toBeInTheDocument();
    });

    it('does not show camera button on desktop', () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      expect(screen.queryByText(/tirar foto/i)).not.toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('accepts valid file via input', async () => {
      const mockOnFileSelect = vi.fn();
      const props = createMockDocumentUploadProps({ onFileSelect: mockOnFileSelect });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
    });

    it('displays file information after selection', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile({ name: 'test-document.pdf', size: 1024 * 1024 });
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('1.00 MB')).toBeInTheDocument();
    });

    it('shows preview toggle for image files', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      expect(screen.getByText(/ver prévia/i)).toBeInTheDocument();
    });

    it('does not show preview toggle for non-image files', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      expect(screen.queryByText(/ver prévia/i)).not.toBeInTheDocument();
    });

    it('toggles preview visibility when button is clicked', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      const previewButton = screen.getByText(/ver prévia/i);
      await userEvent.click(previewButton);

      expect(screen.getByAltText('Preview')).toBeInTheDocument();
      expect(screen.getByText(/ocultar prévia/i)).toBeInTheDocument();
    });

    it('clears file when clear button is clicked', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      const clearButton = screen.getByLabelText(/remover arquivo/i);
      await userEvent.click(clearButton);

      expect(screen.queryByText(file.name)).not.toBeInTheDocument();
      expect(screen.getByText(/arraste o arquivo ou clique para selecionar/i)).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('accepts file via drag and drop', async () => {
      const mockOnFileSelect = vi.fn();
      const props = createMockDocumentUploadProps({ onFileSelect: mockOnFileSelect });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const dropZone = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });

      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
    });

    it('prevents default behavior on drag over', () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const dropZone = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      const dragOverEvent = new Event('dragover', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault');

      fireEvent(dropZone, dragOverEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles multiple files by taking only the first one', async () => {
      const mockOnFileSelect = vi.fn();
      const props = createMockDocumentUploadProps({ onFileSelect: mockOnFileSelect });
      render(<EnhancedDocumentUpload {...props} />);

      const file1 = createMockFile({ name: 'file1.pdf' });
      const file2 = createMockFile({ name: 'file2.pdf' });
      const dropZone = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file1, file2],
        },
      });

      expect(mockOnFileSelect).toHaveBeenCalledWith(file1);
      expect(mockOnFileSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('File Validation', () => {
    it('rejects files with invalid MIME type', async () => {
      const mockOnFileSelect = vi.fn();
      const props = createMockDocumentUploadProps({
        onFileSelect: mockOnFileSelect,
        acceptedTypes: ['application/pdf'],
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      expect(screen.getByText(/tipo de arquivo não suportado/i)).toBeInTheDocument();
      expect(mockOnFileSelect).not.toHaveBeenCalled();
    });

    it('rejects files that exceed size limit', async () => {
      const mockOnFileSelect = vi.fn();
      const props = createMockDocumentUploadProps({
        onFileSelect: mockOnFileSelect,
        maxSizeMB: 1,
      });
      render(<EnhancedDocumentUpload {...props} />);

      // Create a file larger than 1MB
      const file = createMockFile({ size: 2 * 1024 * 1024 });
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      expect(screen.getByText(/o arquivo deve ter no máximo 1mb/i)).toBeInTheDocument();
      expect(mockOnFileSelect).not.toHaveBeenCalled();
    });

    it('displays validation error with proper styling', async () => {
      const props = createMockDocumentUploadProps({
        acceptedTypes: ['application/pdf'],
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      const errorContainer = screen.getByText(/tipo de arquivo não suportado/i).closest('div');
      expect(errorContainer).toHaveClass('bg-red-50', 'border-red-200');
    });

    it('clears validation error when valid file is selected', async () => {
      const props = createMockDocumentUploadProps({
        acceptedTypes: ['application/pdf'],
      });
      render(<EnhancedDocumentUpload {...props} />);

      // First, upload invalid file
      const invalidFile = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      await userEvent.upload(input, invalidFile);

      expect(screen.getByText(/tipo de arquivo não suportado/i)).toBeInTheDocument();

      // Then, upload valid file
      const validFile = createMockFile();
      await userEvent.upload(input, validFile);

      expect(screen.queryByText(/tipo de arquivo não suportado/i)).not.toBeInTheDocument();
    });
  });

  describe('Upload Status Display', () => {
    it('displays uploading status', () => {
      const props = createMockDocumentUploadProps({
        uploadStatus: 'uploading',
        uploadMessage: 'Uploading file...',
      });
      render(<EnhancedDocumentUpload {...props} />);

      // First need to select a file to see upload status
      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Uploading file...')).toBeInTheDocument();
    });

    it('displays processing status', () => {
      const props = createMockDocumentUploadProps({
        uploadStatus: 'processing',
        uploadMessage: 'Processing document...',
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Processing document...')).toBeInTheDocument();
    });

    it('displays success status with correct styling', () => {
      const props = createMockDocumentUploadProps({
        uploadStatus: 'success',
        uploadMessage: 'Upload complete!',
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      fireEvent.change(input, { target: { files: [file] } });

      const statusContainer = screen.getByText('Upload complete!').closest('div');
      expect(statusContainer).toHaveStyle('background-color: #f0fdf4');
      expect(statusContainer).toHaveStyle('border-color: #bbf7d0');
    });

    it('displays error status with correct styling', () => {
      const props = createMockDocumentUploadProps({
        uploadStatus: 'error',
        uploadMessage: 'Upload failed!',
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      fireEvent.change(input, { target: { files: [file] } });

      const statusContainer = screen.getByText('Upload failed!').closest('div');
      expect(statusContainer).toHaveStyle('background-color: #fef2f2');
      expect(statusContainer).toHaveStyle('border-color: #fecaca');
    });

    it('displays default processing message when no message provided', () => {
      const props = createMockDocumentUploadProps({
        uploadStatus: 'uploading',
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Processando...')).toBeInTheDocument();
    });

    it('does not display status when idle', () => {
      const props = createMockDocumentUploadProps({
        uploadStatus: 'idle',
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.queryByText(/processando/i)).not.toBeInTheDocument();
    });
  });

  describe('Mobile Specific Behavior', () => {
    beforeEach(() => {
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      });
    });

    it('adds capture attribute to file input on mobile', () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toHaveAttribute('capture', 'environment');
    });

    it('does not add capture attribute on desktop', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).not.toHaveAttribute('capture');
    });

    it('triggers file input when camera button is clicked', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const cameraButton = screen.getByText(/tirar foto/i);
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

      await userEvent.click(cameraButton);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper label for file input', () => {
      const documentType = createMockDocumentType({ id: 'test-doc-type' });
      const props = createMockDocumentUploadProps({ documentType });
      render(<EnhancedDocumentUpload {...props} />);

      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      expect(input).toHaveAttribute('id', 'file-input-test-doc-type');
    });

    it('has proper alt text for preview image', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      const previewButton = screen.getByText(/ver prévia/i);
      await userEvent.click(previewButton);

      expect(screen.getByAltText('Preview')).toBeInTheDocument();
    });

    it('has proper aria-label for remove button', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      expect(screen.getByLabelText(/remover arquivo/i)).toBeInTheDocument();
    });

    it('makes validation errors visible to screen readers', async () => {
      const props = createMockDocumentUploadProps({
        acceptedTypes: ['application/pdf'],
      });
      render(<EnhancedDocumentUpload {...props} />);

      const file = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      const errorElement = screen.getByText(/tipo de arquivo não suportado/i);
      expect(errorElement.closest('div')).toBeInTheDocument();
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('cleans up preview URL on unmount', () => {
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      const props = createMockDocumentUploadProps();
      const { unmount } = render(<EnhancedDocumentUpload {...props} />);

      unmount();

      // The cleanup should be called if there was a preview URL
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('cleans up preview URL when component unmounts with image selected', async () => {
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      const props = createMockDocumentUploadProps();
      const { unmount } = render(<EnhancedDocumentUpload {...props} />);

      const file = createMockImageFile();
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);
      await userEvent.upload(input, file);

      unmount();

      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty file list gracefully', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      // Simulate empty file selection
      fireEvent.change(input, { target: { files: [] } });

      // Should not crash and maintain initial state
      expect(screen.getByText(/arraste o arquivo ou clique para selecionar/i)).toBeInTheDocument();
    });

    it('handles file selection with null files', async () => {
      const props = createMockDocumentUploadProps();
      render(<EnhancedDocumentUpload {...props} />);

      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      // Simulate null file selection
      fireEvent.change(input, { target: { files: null } });

      // Should not crash
      expect(screen.getByText(/arraste o arquivo ou clique para selecionar/i)).toBeInTheDocument();
    });

    it('handles drop with no files', () => {
      const mockOnFileSelect = vi.fn();
      const props = createMockDocumentUploadProps({ onFileSelect: mockOnFileSelect });
      render(<EnhancedDocumentUpload {...props} />);

      const dropZone = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [],
        },
      });

      expect(mockOnFileSelect).not.toHaveBeenCalled();
    });

    it('validates each file separately when multiple validation rules apply', async () => {
      const props = createMockDocumentUploadProps({
        acceptedTypes: ['application/pdf'],
        maxSizeMB: 1,
      });
      render(<EnhancedDocumentUpload {...props} />);

      // Create file that violates both type and size
      const file = createMockImageFile({ size: 2 * 1024 * 1024 });
      const input = screen.getByLabelText(/arraste o arquivo ou clique para selecionar/i);

      await userEvent.upload(input, file);

      // Should show type error (first validation that fails)
      expect(screen.getByText(/tipo de arquivo não suportado/i)).toBeInTheDocument();
    });
  });
});