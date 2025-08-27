// Tesseract.js Dynamic Loading Fix
// Resolves the chunk loading error by properly configuring the worker path

export const configureTesseractWorker = () => {
  // Ensure we're in browser environment
  if (typeof window === 'undefined') return;

  // Fix for the undefined path issue
  // The worker needs to know where to load its files from
  const workerPath = '/_next/static/chunks/';
  
  // Set global configuration for Tesseract.js
  if (typeof window !== 'undefined' && !window.__TESSERACT_CONFIGURED__) {
    // Mark as configured to prevent multiple configurations
    window.__TESSERACT_CONFIGURED__ = true;
    
    // Configure the worker path if needed
    window.Tesseract = window.Tesseract || {};
    window.Tesseract.workerPath = workerPath;
  }
};

// Type augmentation for window object
declare global {
  interface Window {
    __TESSERACT_CONFIGURED__?: boolean;
    Tesseract?: {
      workerPath?: string;
      [key: string]: any;
    };
  }
}

export const getTesseractWorkerOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    workerPath: '/tesseract/worker.min.js',
    langPath: '/tesseract/lang-data',
    corePath: isProduction 
      ? '/tesseract/tesseract-core.wasm.js'
      : '/tesseract/tesseract-core.wasm.js',
    logger: (m: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[OCR]', m);
      }
    }
  };
};

// Safe dynamic import with fallback
export const loadTesseractSafely = async () => {
  try {
    // Configure before loading
    configureTesseractWorker();
    
    // Dynamic import with error handling
    const Tesseract = await import('tesseract.js');
    
    // Return configured worker creator
    return {
      createWorker: async (options = {}) => {
        const workerOptions = getTesseractWorkerOptions();
        return Tesseract.createWorker({
          ...workerOptions,
          ...options
        });
      }
    };
  } catch (error) {
    console.error('Failed to load Tesseract.js:', error);
    // Return a mock worker that fails gracefully
    return {
      createWorker: async () => {
        throw new Error('OCR service is currently unavailable. Please try again later.');
      }
    };
  }
};