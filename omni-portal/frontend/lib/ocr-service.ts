import { Worker, RecognizeResult, createScheduler, Scheduler } from 'tesseract.js';
import { createTesseractWorker } from './tesseract-runtime-loader';
import { OCRWorkerManager } from './web-worker-ocr';
import { compressImage, validateImageQuality } from './image-optimizer';
import type { OCRResult, OCRBlock, BoundingBox, ExtractedDocumentData, DocumentValidation } from '@/types/ocr';
import { makeCancellable, type CancellableRequest } from './async-utils';

// OCR interfaces are now imported from @/types/ocr

export interface OCRProgress {
  status: string;
  progress: number;
}

export class OCRService {
  private worker: Worker | null = null;
  private workerManager: OCRWorkerManager | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;
  private activeRequests = new Set<CancellableRequest<any>>();
  private useWebWorker = typeof Worker !== 'undefined';

  async initialize(onProgress?: (progress: OCRProgress) => void, signal?: AbortSignal): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    // Create a new abort controller for this initialization
    this.abortController = new AbortController();
    
    // Link external signal if provided
    if (signal) {
      signal.addEventListener('abort', () => {
        this.abortController?.abort();
      });
    }

    this.initPromise = this.createWorker(onProgress, this.abortController.signal);
    
    try {
      await this.initPromise;
      this.isInitialized = true;
    } catch (error) {
      // Reset state on failure
      this.initPromise = null;
      this.abortController = null;
      throw error;
    }
  }

  private async createWorker(onProgress?: (progress: OCRProgress) => void, signal?: AbortSignal): Promise<void> {
    // Check if operation was aborted before starting
    if (signal?.aborted) {
      throw new Error('OCR initialization was cancelled');
    }

    try {
      // Technical Excellence: Lazy loading implementation with runtime download
      // Files are downloaded only when OCR is actually used, preventing build hangs
      this.worker = await createTesseractWorker({
        langs: ['por', 'eng'],
        logger: (m: { status: string; progress: number }) => {
          // Check cancellation before progress updates
          if (signal?.aborted) return;
          
          if (onProgress) {
            onProgress({
              status: m.status,
              progress: m.progress,
            });
          }
        }
      });

      // Check cancellation after worker creation
      if (signal?.aborted) {
        await this.worker?.terminate();
        this.worker = null;
        throw new Error('OCR initialization was cancelled');
      }

      if (!this.worker) {
        throw new Error('Failed to create OCR worker');
      }

      // Language loading and initialization is now handled in createWorker
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ .,/-:',
      });
      
      // Final cancellation check
      if (signal?.aborted) {
        await this.worker.terminate();
        this.worker = null;
        throw new Error('OCR initialization was cancelled');
      }
    } catch (error) {
      // Clean up on any error
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
      }
      throw error;
    }
  }

  async recognizeText(
    file: File,
    documentType: string,
    onProgress?: (progress: OCRProgress) => void,
    signal?: AbortSignal
  ): Promise<OCRResult> {
    // Create cancellable request
    const request = makeCancellable(async (abortSignal: AbortSignal) => {
      if (!this.isInitialized) {
        await this.initialize(onProgress, abortSignal);
      }

      // Check cancellation before processing
      if (abortSignal.aborted) {
        throw new Error('OCR recognition was cancelled');
      }

      try {
        // Validate and optimize image before processing
        const qualityCheck = await validateImageQuality(file);
        if (!qualityCheck.isValid) {
          throw new Error(`Image quality issues: ${qualityCheck.issues.join(', ')}`);
        }

        // Compress image before OCR with cancellation support
        const compressedFile = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.9,
        });

        // Check cancellation after compression
        if (abortSignal.aborted) {
          throw new Error('OCR recognition was cancelled');
        }

        if (!this.worker) {
          throw new Error('OCR worker not initialized');
        }
        
        // OCR recognition with periodic cancellation checks
        const result = await this.worker.recognize(compressedFile);
        
        // Check cancellation before data extraction
        if (abortSignal.aborted) {
          throw new Error('OCR recognition was cancelled');
        }
        
        // Extract structured data based on document type
        const extractedData = this.extractStructuredData(result, documentType);

        return {
          text: result.data.text,
          confidence: result.data.confidence,
          blocks: result.data.blocks?.map(block => ({
            text: block.text,
            confidence: block.confidence,
            bbox: {
              x0: block.bbox?.x0 ?? 0,
              y0: block.bbox?.y0 ?? 0,
              x1: block.bbox?.x1 ?? 0,
              y1: block.bbox?.y1 ?? 0,
            }
          })) || [],
          lines: result.data.lines?.map(line => line.text) || [],
          extractedData,
        };
      } catch (error) {
        // Don't log cancelled operations as errors
        if (abortSignal.aborted) {
          throw new Error('OCR recognition was cancelled');
        }
        console.error('OCR recognition failed:', error);
        if (error instanceof Error) {
          if (error.message.includes('Could not process image')) {
            throw new Error('Invalid image format or corrupted file. Please try a different image.');
          }
          if (error.message.includes('Image quality')) {
            throw error; // Re-throw quality errors as-is
          }
          if (error.message.includes('network') || error.message.includes('fetch')) {
            throw new Error('Network error while loading OCR resources. Please check your internet connection.');
          }
        }
        throw new Error('Could not process image. Please try again with a clearer image.');
      }
    }, { timeout: 30000 }); // 30-second timeout

    // Link external signal
    if (signal) {
      signal.addEventListener('abort', () => {
        request.cancel();
      });
    }

    // Track active request
    this.activeRequests.add(request);
    
    try {
      const result = await request.promise;
      return result;
    } finally {
      this.activeRequests.delete(request);
    }
  }

  private extractStructuredData(
    result: RecognizeResult,
    documentType: string
  ): ExtractedDocumentData {
    const text = result.data.text;
    const data: ExtractedDocumentData = {};

    switch (documentType) {
      case 'rg':
      case 'rg_cnh':
        data.rg = this.extractPattern(text, /(\d{1,2}\.?\d{3}\.?\d{3}-?\d{1})/);
        data.name = this.extractPattern(text, /NOME[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i);
        data.birthDate = this.extractPattern(text, /(\d{1,2}\/\d{1,2}\/\d{4})/);
        break;
      
      case 'cpf':
        data.cpf = this.extractPattern(text, /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
        data.name = this.extractPattern(text, /NOME[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i);
        break;
      
      case 'comprovante_residencia':
        data.cep = this.extractPattern(text, /(\d{5}-?\d{3})/);
        data.street = this.extractPattern(text, /(?:RUA|AV|AVENIDA|ALAMEDA)[:\s]*([^,\n]+)/i);
        data.city = this.extractPattern(text, /(?:CIDADE|MUNICÍPIO)[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i);
        break;
    }

    return data;
  }

  private extractPattern(text: string, pattern: RegExp): string {
    const match = text.match(pattern);
    return match?.[1]?.trim() || '';
  }

  async processMultipleDocuments(
    files: File[],
    documentTypes: string[],
    onProgress?: (index: number, progress: OCRProgress) => void,
    signal?: AbortSignal
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    const activeOperations: CancellableRequest<OCRResult>[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        // Check cancellation before each operation
        if (signal?.aborted) {
          throw new Error('Multiple document processing was cancelled');
        }

        const file = files[i];
        const docType = documentTypes[i];
        
        if (!file || !docType) {
          throw new Error(`Missing file or document type at index ${i}`);
        }
        
        const result = await this.recognizeText(
          file,
          docType,
          (progress) => onProgress?.(i, progress),
          signal
        );
        results.push(result);
      }

      return results;
    } catch (error) {
      // Cancel all remaining operations on error
      activeOperations.forEach(op => {
        if (!op.isCancelled()) {
          op.cancel();
        }
      });
      throw error;
    }
  }

  async validateDocument(
    ocrResult: OCRResult,
    expectedData: Record<string, string>
  ): Promise<DocumentValidation> {
    const validation = {
      isValid: true,
      confidence: ocrResult.confidence,
      errors: [] as string[],
      warnings: [] as string[],
    };

    if (ocrResult.confidence < 70) {
      validation.warnings.push('Baixa confiança na leitura do documento');
    }

    if (ocrResult.confidence < 50) {
      validation.errors.push('Qualidade da imagem muito baixa');
      validation.isValid = false;
    }

    // Validate extracted data against expected data
    if (ocrResult.extractedData && expectedData) {
      for (const [key, expectedValue] of Object.entries(expectedData)) {
        const extractedValue = ocrResult.extractedData[key];
        
        if (!extractedValue) {
          validation.warnings.push(`Campo ${key} não encontrado no documento`);
          continue;
        }

        const similarity = this.calculateSimilarity(
          this.normalizeString(extractedValue),
          this.normalizeString(expectedValue)
        );

        if (similarity < 70) {
          validation.errors.push(`${key} no documento não confere com o cadastro`);
          validation.isValid = false;
        } else if (similarity < 85) {
          validation.warnings.push(`${key} tem pequenas diferenças`);
        }
      }
    }

    return validation;
  }

  private normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      if (matrix[0]) {
        matrix[0][j] = j;
      }
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];
        
        if (!currentRow || !prevRow) continue;
        
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          currentRow[j] = prevRow[j - 1] ?? 0;
        } else {
          currentRow[j] = Math.min(
            (prevRow[j - 1] ?? 0) + 1,
            (currentRow[j - 1] ?? 0) + 1,
            (prevRow[j] ?? 0) + 1
          );
        }
      }
    }
    
    return matrix[str2.length]?.[str1.length] ?? 0;
  }

  async terminate(): Promise<void> {
    // Cancel all active requests
    this.activeRequests.forEach(request => {
      if (!request.isCancelled()) {
        request.cancel();
      }
    });
    this.activeRequests.clear();

    // Cancel initialization if in progress
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Terminate worker
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (error) {
        console.warn('Error terminating OCR worker:', error);
      } finally {
        this.worker = null;
        this.isInitialized = false;
        this.initPromise = null;
      }
    }
  }

  /**
   * Cancel all active OCR operations
   */
  cancelAllOperations(): void {
    this.activeRequests.forEach(request => {
      if (!request.isCancelled()) {
        request.cancel();
      }
    });
    this.activeRequests.clear();
  }

  /**
   * Get the number of active operations
   */
  getActiveOperationCount(): number {
    return this.activeRequests.size;
  }
}

// Singleton instance
export const ocrService = new OCRService();