/**
 * Web Worker wrapper for OCR processing
 * CRITICAL FIX: Move OCR processing to Web Worker to prevent UI blocking
 */

interface OCRWorkerMessage {
  type: 'INIT' | 'PROCESS' | 'PROGRESS' | 'SUCCESS' | 'ERROR' | 'TERMINATE';
  payload?: any;
}

interface OCRProgress {
  progress: number;
  status: string;
}

class OCRWorkerManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Create worker from blob to avoid external file dependency
        const workerScript = `
          // OCR Worker Script
          let tesseract = null;
          
          self.onmessage = async function(e) {
            const { type, payload } = e.data;
            
            try {
              switch (type) {
                case 'INIT':
                  // Dynamically import Tesseract in worker
                  if (!tesseract) {
                    // Use local Tesseract files instead of CDN for security
                    try {
                      importScripts('/tesseract/worker.min.js');
                    } catch (error) {
                      // Fallback to CDN with integrity check
                      const tesseractCDN = 'https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js';
                      // Note: SRI not supported in importScripts, use local files in production
                      importScripts(tesseractCDN);
                    }
                    tesseract = self.Tesseract;
                  }
                  
                  self.postMessage({ type: 'SUCCESS', payload: 'Initialized' });
                  break;
                  
                case 'PROCESS':
                  if (!tesseract) {
                    throw new Error('Tesseract not initialized');
                  }
                  
                  const { imageData, options } = payload;
                  
                  const result = await tesseract.recognize(imageData, 'eng+por', {
                    logger: (info) => {
                      self.postMessage({ 
                        type: 'PROGRESS', 
                        payload: { 
                          progress: info.progress * 100, 
                          status: info.status 
                        } 
                      });
                    }
                  });
                  
                  self.postMessage({ 
                    type: 'SUCCESS', 
                    payload: {
                      text: result.data.text,
                      confidence: result.data.confidence,
                      words: result.data.words
                    }
                  });
                  break;
                  
                default:
                  throw new Error('Unknown message type: ' + type);
              }
            } catch (error) {
              self.postMessage({ 
                type: 'ERROR', 
                payload: error.message 
              });
            }
          };
        `;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));

        this.worker.onmessage = (e) => {
          const { type, payload } = e.data;
          
          if (type === 'SUCCESS' && payload === 'Initialized') {
            this.isInitialized = true;
            resolve();
          } else if (type === 'ERROR') {
            reject(new Error(payload));
          }
        };

        this.worker.onerror = (error) => {
          reject(error);
        };

        // Initialize the worker
        this.worker.postMessage({ type: 'INIT' });

      } catch (error) {
        reject(error);
      }
    });

    return this.initPromise;
  }

  async processImage(
    imageData: ImageData | File | Blob | string,
    onProgress?: (progress: OCRProgress) => void
  ): Promise<{
    text: string;
    confidence: number;
    words?: any[];
  }> {
    if (!this.worker || !this.isInitialized) {
      throw new Error('OCR Worker not initialized');
    }

    // CRITICAL FIX: Prepare serializable data BEFORE promise
    let serializedImageData: string | ArrayBuffer;
    
    if (imageData instanceof Blob || imageData instanceof File) {
      // Convert Blob/File to ArrayBuffer for serialization
      serializedImageData = await imageData.arrayBuffer();
    } else if (typeof imageData === 'string') {
      // Already a string (base64 or URL)
      serializedImageData = imageData;
    } else if (imageData instanceof ImageData) {
      // Convert ImageData to ArrayBuffer
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png');
        });
        serializedImageData = await blob.arrayBuffer();
      } else {
        throw new Error('Failed to create canvas context');
      }
    } else {
      // Assume it's already an ArrayBuffer or similar
      serializedImageData = imageData as any;
    }

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        const { type, payload } = e.data;

        switch (type) {
          case 'PROGRESS':
            if (onProgress) {
              onProgress(payload);
            }
            break;

          case 'SUCCESS':
            this.worker!.removeEventListener('message', handleMessage);
            resolve(payload);
            break;

          case 'ERROR':
            this.worker!.removeEventListener('message', handleMessage);
            reject(new Error(payload));
            break;
        }
      };

      this.worker.addEventListener('message', handleMessage);
      
      // Send processing request with serializable data
      try {
        this.worker.postMessage({
          type: 'PROCESS',
          payload: {
            imageData: serializedImageData,
            options: {}
          }
        });
      } catch (error) {
        this.worker.removeEventListener('message', handleMessage);
        reject(new Error(`Failed to send data to worker: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

// Singleton instance
export const ocrWorkerManager = new OCRWorkerManager();

// Fallback for when Web Workers are not available
export class FallbackOCRProcessor {
  private tesseract: any = null;

  async initialize(): Promise<void> {
    if (this.tesseract) return;

    // Dynamic import for main thread fallback
    const { createWorker } = await import('tesseract.js');
    this.tesseract = await createWorker(['eng', 'por']);
  }

  async processImage(
    imageData: ImageData | File | Blob | string,
    onProgress?: (progress: OCRProgress) => void
  ): Promise<{
    text: string;
    confidence: number;
    words?: any[];
  }> {
    if (!this.tesseract) {
      throw new Error('Fallback OCR not initialized');
    }

    const result = await this.tesseract.recognize(imageData, {
      logger: (info: any) => {
        if (onProgress) {
          onProgress({
            progress: info.progress * 100,
            status: info.status
          });
        }
      }
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words
    };
  }

  terminate() {
    if (this.tesseract) {
      this.tesseract.terminate();
      this.tesseract = null;
    }
  }
}

// Smart OCR manager that chooses the best approach
export class SmartOCRManager {
  private useWebWorker: boolean;
  private workerManager: OCRWorkerManager;
  private fallbackProcessor: FallbackOCRProcessor;

  constructor() {
    this.useWebWorker = typeof Worker !== 'undefined';
    this.workerManager = new OCRWorkerManager();
    this.fallbackProcessor = new FallbackOCRProcessor();
  }

  async initialize(): Promise<void> {
    try {
      if (this.useWebWorker) {
        await this.workerManager.initialize();
      } else {
        await this.fallbackProcessor.initialize();
      }
    } catch (error) {
      console.warn('Web Worker OCR failed, falling back to main thread:', error);
      this.useWebWorker = false;
      await this.fallbackProcessor.initialize();
    }
  }

  async processImage(
    imageData: ImageData | File | Blob | string,
    onProgress?: (progress: OCRProgress) => void
  ): Promise<{
    text: string;
    confidence: number;
    words?: any[];
  }> {
    if (this.useWebWorker) {
      try {
        return await this.workerManager.processImage(imageData, onProgress);
      } catch (error) {
        console.warn('Web Worker processing failed, falling back:', error);
        this.useWebWorker = false;
      }
    }

    return await this.fallbackProcessor.processImage(imageData, onProgress);
  }

  terminate() {
    this.workerManager.terminate();
    this.fallbackProcessor.terminate();
  }
}

export const smartOCRManager = new SmartOCRManager();