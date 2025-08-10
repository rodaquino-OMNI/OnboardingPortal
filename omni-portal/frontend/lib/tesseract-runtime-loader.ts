/**
 * Runtime Tesseract Loader
 * Downloads Tesseract files on-demand to prevent build process hanging
 */

import { createWorker } from 'tesseract.js';

let tesseractInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function downloadTesseractFiles(): Promise<void> {
  // Check if placeholder exists indicating setup needed
  try {
    const response = await fetch('/tesseract/.needs-setup');
    if (response.ok) {
      console.log('Tesseract files need to be downloaded...');
      
      // In production, load from CDN
      // In development, use local fallback
      const cdnBase = process.env.NEXT_PUBLIC_TESSERACT_CDN || 
                      'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist';
      
      // Worker will handle downloading required files
      console.log('Tesseract will download required files on first use');
    }
  } catch (error) {
    // Files might already be present
    console.log('Tesseract files may already be available');
  }
}

export async function initializeTesseract(): Promise<void> {
  if (tesseractInitialized) return;
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      await downloadTesseractFiles();
      tesseractInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Tesseract:', error);
      throw error;
    }
  })();
  
  return initializationPromise;
}

export async function createTesseractWorker(options?: any) {
  // Ensure Tesseract is initialized
  await initializeTesseract();
  
  const { langs = ['eng'], ...workerOptions } = options;
  
  // Create worker with intelligent loading strategy
  try {
    // First, try local files if they exist
    const localResponse = await fetch('/tesseract/worker.min.js', { method: 'HEAD' });
    if (localResponse.ok) {
      // Local files exist, use them
      const worker = await createWorker(langs.join('+'), 1, {
        workerPath: '/tesseract/worker.min.js',
        langPath: '/tesseract/lang-data',
        corePath: '/tesseract/tesseract-core.wasm.js',
        cacheMethod: 'refresh',
        ...workerOptions
      });
      return worker;
    }
  } catch (error) {
    console.log('Local tesseract files not found, using CDN');
  }
  
  // Fallback to CDN (default behavior)
  const worker = await createWorker(langs.join('+'), 1, {
    ...workerOptions,
    // Let tesseract.js use its default CDN
  });
  
  return worker;
}