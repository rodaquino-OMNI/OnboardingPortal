import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedDocumentUpload } from '@/components/upload/EnhancedDocumentUpload';
import { useGamification } from '@/hooks/useGamification';
import api from '@/services/api';

// Mock dependencies
jest.mock('@/hooks/useGamification');
jest.mock('@/services/api');
jest.mock('@/lib/ocr-service', () => ({
  ocrService: {
    initialize: jest.fn(() => Promise.resolve()),
    recognizeText: jest.fn(() => Promise.resolve({
      extractedData: { name: 'João Silva', document: '123456789' },
      confidence: 0.95
    })),
    validateDocument: jest.fn(() => Promise.resolve({
      isValid: true,
      confidence: 95,
      errors: [],
      warnings: []
    }))
  }
}));
jest.mock('@/lib/image-optimizer', () => ({
  compressImage: jest.fn((file) => Promise.resolve(file)),
  validateImageQuality: jest.fn(() => Promise.resolve({ isValid: true, issues: [] }))
}));
jest.mock('@/lib/ocr-service', () => ({
  ocrService: {
    processDocument: jest.fn(() => Promise.resolve({
      text: 'Sample OCR text',
      confidence: 0.95,
      fields: {
        name: 'João Silva',
        document_number: '12.345.678-9'
      }
    }))
  }
}));
jest.mock('@/lib/image-optimizer', () => ({
  compressImage: jest.fn((file) => Promise.resolve(file)),
  validateImageQuality: jest.fn(() => ({
    isValid: true,
    issues: [],
    quality: 0.9
  }))
}));

const mockAddPoints = jest.fn();
const mockUnlockBadge = jest.fn();

// Mock file creation
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('EnhancedDocumentUpload', () => {
  const defaultProps = {
    documentType: {
      id: 'rg',
      name: 'RG',
      required: true,
      type: 'identity'
    },
    onUploadComplete: jest.fn(),
    onUploadProgress: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useGamification as unknown as jest.Mock).mockReturnValue({
      addPoints: mockAddPoints,
      unlockBadge: mockUnlockBadge,
      progress: null,
      stats: null,
      badges: { earned: [], available: [] },
      leaderboard: [],
      activityFeed: [],
      dashboardSummary: null,
      isLoading: false,
      error: null
    });
  });

  describe('Rendering', () => {
    it('renders upload interface correctly', () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      expect(screen.getByText(/upload de documentos/i)).toBeInTheDocument();
      expect(screen.getByText(/arraste e solte/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /selecionar arquivos/i })).toBeInTheDocument();
    });

    it('displays supported file types', () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      expect(screen.getByText(/formatos aceitos/i)).toBeInTheDocument();
      expect(screen.getByText(/jpg/i)).toBeInTheDocument();
      expect(screen.getByText(/png/i)).toBeInTheDocument();
      expect(screen.getByText(/pdf/i)).toBeInTheDocument();
    });

    it('shows file size limit', () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      expect(screen.getByText(/tamanho máximo: 10mb/i)).toBeInTheDocument();
    });

    it('displays document type options', () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      expect(screen.getByText(/rg/i)).toBeInTheDocument();
      expect(screen.getByText(/cpf/i)).toBeInTheDocument();
      expect(screen.getByText(/comprovante de residência/i)).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('handles file selection via button click', async () => {
      const user = userEvent.setup();
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      
      await user.upload(fileInput, file);
      
      expect(screen.getByText('document.jpg')).toBeInTheDocument();
      expect(screen.getByText(/1.0 mb/i)).toBeInTheDocument();
    });

    it('validates file type', async () => {
      const user = userEvent.setup();
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const invalidFile = createMockFile('document.exe', 1024, 'application/exe');
      
      await user.upload(fileInput, invalidFile);
      
      expect(await screen.findByText(/tipo de arquivo não suportado/i)).toBeInTheDocument();
    });

    it('validates file size', async () => {
      const user = userEvent.setup();
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const largeFile = createMockFile('large.jpg', 15 * 1024 * 1024, 'image/jpeg');
      
      await user.upload(fileInput, largeFile);
      
      expect(await screen.findByText(/arquivo muito grande/i)).toBeInTheDocument();
    });

    it('handles multiple file selection', async () => {
      const user = userEvent.setup();
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const files = [
        createMockFile('doc1.jpg', 1024 * 1024, 'image/jpeg'),
        createMockFile('doc2.pdf', 2 * 1024 * 1024, 'application/pdf')
      ];
      
      await user.upload(fileInput, files);
      
      expect(screen.getByText('doc1.jpg')).toBeInTheDocument();
      expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('handles drag enter', () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drop-zone');
      fireEvent.dragEnter(dropZone);
      
      expect(dropZone).toHaveClass('drag-active');
    });

    it('handles drag leave', () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drop-zone');
      fireEvent.dragEnter(dropZone);
      fireEvent.dragLeave(dropZone);
      
      expect(dropZone).not.toHaveClass('drag-active');
    });

    it('handles file drop', async () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drop-zone');
      const file = createMockFile('dropped.jpg', 1024 * 1024, 'image/jpeg');
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      });
      
      await waitFor(() => {
        expect(screen.getByText('dropped.jpg')).toBeInTheDocument();
      });
    });
  });

  describe('File Upload', () => {
    it('uploads file successfully', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          id: '123',
          status: 'processing',
          ocr_data: { name: 'João Silva' }
        }
      });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Select file
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      
      // Select document type
      await user.click(screen.getByText(/rg/i));
      
      // Upload
      const uploadButton = screen.getByRole('button', { name: /enviar documento/i });
      await user.click(uploadButton);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/documents/upload',
          expect.any(FormData),
          expect.objectContaining({
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      });
    });

    it('shows upload progress', async () => {
      const user = userEvent.setup();
      let progressCallback: any;
      
      (api.post as jest.Mock).mockImplementation((url, data, config) => {
        progressCallback = config.onUploadProgress;
        setTimeout(() => {
          progressCallback({ loaded: 50, total: 100 });
        }, 10);
        return new Promise(resolve => setTimeout(resolve, 100));
      });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Upload file
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/50%/)).toBeInTheDocument();
      });
    });

    it('handles upload errors', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockRejectedValue(new Error('Upload failed'));
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Upload file
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      expect(await screen.findByText(/erro ao enviar documento/i)).toBeInTheDocument();
    });
  });

  describe('OCR Processing', () => {
    it('displays OCR results', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          id: '123',
          status: 'completed',
          ocr_data: {
            name: 'João Silva',
            document_number: '12.345.678-9',
            birth_date: '01/01/1990'
          }
        }
      });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Upload file
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/dados extraídos/i)).toBeInTheDocument();
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getByText('12.345.678-9')).toBeInTheDocument();
      });
    });

    it('allows editing OCR data', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          id: '123',
          status: 'completed',
          ocr_data: {
            name: 'João Silva',
            document_number: '12.345.678-9'
          }
        }
      });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Upload and wait for OCR
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument();
      });
      
      // Edit name
      const nameInput = screen.getByDisplayValue('João Silva');
      await user.clear(nameInput);
      await user.type(nameInput, 'João Santos');
      
      expect(nameInput).toHaveValue('João Santos');
    });
  });

  describe('Document Validation', () => {
    it('validates document authenticity', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock)
        .mockResolvedValueOnce({
          data: {
            id: '123',
            status: 'completed',
            ocr_data: { name: 'João Silva' }
          }
        })
        .mockResolvedValueOnce({
          data: {
            valid: true,
            confidence: 0.95,
            issues: []
          }
        });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Upload and validate
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/documento válido/i)).toBeInTheDocument();
        expect(screen.getByText(/95%/)).toBeInTheDocument();
      });
    });

    it('shows validation issues', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock)
        .mockResolvedValueOnce({
          data: {
            id: '123',
            status: 'completed',
            ocr_data: { name: 'João Silva' }
          }
        })
        .mockResolvedValueOnce({
          data: {
            valid: false,
            confidence: 0.40,
            issues: [
              'Qualidade da imagem baixa',
              'Documento possivelmente vencido'
            ]
          }
        });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Upload
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/problemas encontrados/i)).toBeInTheDocument();
        expect(screen.getByText(/qualidade da imagem baixa/i)).toBeInTheDocument();
        expect(screen.getByText(/documento possivelmente vencido/i)).toBeInTheDocument();
      });
    });
  });

  describe('Gamification', () => {
    it('awards points for successful upload', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          id: '123',
          status: 'completed',
          ocr_data: { name: 'João Silva' }
        }
      });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Upload file
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        expect(mockAddPoints).toHaveBeenCalledWith(50, 'document_upload');
      });
    });

    it('unlocks badge for completing all documents', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          id: '123',
          status: 'completed',
          ocr_data: { name: 'João Silva' }
        }
      });
      
      const props = {
        ...defaultProps
      };
      
      render(<EnhancedDocumentUpload {...props} />);
      
      // Upload last required document
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('rg.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        expect(mockUnlockBadge).toHaveBeenCalledWith('document_master');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Upload de documentos');
      expect(screen.getByLabelText(/selecionar arquivos/i)).toBeInTheDocument();
    });

    it('announces upload status', async () => {
      const user = userEvent.setup();
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          id: '123',
          status: 'completed'
        }
      });
      
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/selecionar arquivos/i);
      const file = createMockFile('document.jpg', 1024 * 1024, 'image/jpeg');
      await user.upload(fileInput, file);
      await user.click(screen.getByText(/rg/i));
      await user.click(screen.getByRole('button', { name: /enviar documento/i }));
      
      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent(/upload concluído/i);
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<EnhancedDocumentUpload {...defaultProps} />);
      
      // Tab through interface
      await user.tab();
      expect(screen.getByLabelText(/selecionar arquivos/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText(/rg/i).closest('button')).toHaveFocus();
    });
  });
});