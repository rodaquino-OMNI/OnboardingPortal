import { createWorker, Worker, RecognizeResult, createScheduler, Scheduler } from 'tesseract.js';
import { compressImage } from './image-optimizer';
import type { OCRResult, OCRBlock, BoundingBox, ExtractedDocumentData, DocumentValidation } from '@/types/ocr';

// OCR interfaces are now imported from @/types/ocr

export interface OCRProgress {
  status: string;
  progress: number;
}

export class OCRService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(onProgress?: (progress: OCRProgress) => void): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.createWorker(onProgress);
    await this.initPromise;
    this.isInitialized = true;
  }

  private async createWorker(onProgress?: (progress: OCRProgress) => void): Promise<void> {
    this.worker = await createWorker('por+eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (onProgress) {
          onProgress({
            status: m.status,
            progress: m.progress,
          });
        }
      },
      workerPath: '/tesseract/worker.min.js',
      langPath: '/tesseract/lang-data',
      corePath: '/tesseract/tesseract-core.wasm.js',
    });

    if (!this.worker) {
      throw new Error('Failed to create OCR worker');
    }

    // Language loading and initialization is now handled in createWorker
    await this.worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ .,/-:',
    });
  }

  async recognizeText(
    file: File,
    documentType: string,
    onProgress?: (progress: OCRProgress) => void
  ): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize(onProgress);
    }

    try {
      // Compress image before OCR
      const compressedFile = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.9,
      });

      if (!this.worker) {
        throw new Error('OCR worker not initialized');
      }
      
      const result = await this.worker.recognize(compressedFile);
      
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
      console.error('OCR recognition failed:', error);
      throw new Error('Failed to process document');
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
    onProgress?: (index: number, progress: OCRProgress) => void
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docType = documentTypes[i];
      
      if (!file || !docType) {
        throw new Error(`Missing file or document type at index ${i}`);
      }
      
      const result = await this.recognizeText(
        file,
        docType,
        (progress) => onProgress?.(i, progress)
      );
      results.push(result);
    }

    return results;
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
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

// Singleton instance
export const ocrService = new OCRService();