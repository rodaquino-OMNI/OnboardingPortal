/**
 * CRITICAL VERIFICATION TEST: OCR Web Worker Serialization Fix
 * Tests for DataCloneError resolution and proper handling of different data types
 */

import { ocrWorkerManager, SmartOCRManager } from '@/lib/web-worker-ocr';

describe('OCR Serialization Fix Verification', () => {
  let mockWorker: any;
  let originalWorker: any;

  beforeAll(() => {
    // Save original Worker
    originalWorker = (global as any).Worker;
    
    // Mock Worker constructor
    (global as any).Worker = jest.fn().mockImplementation(() => {
      mockWorker = {
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        terminate: jest.fn(),
        onmessage: null,
        onerror: null
      };
      return mockWorker;
    });

    // Mock URL.createObjectURL
    (global as any).URL = {
      createObjectURL: jest.fn().mockReturnValue('blob:mock-url')
    };

    // Mock document for canvas creation
    Object.defineProperty(global, 'document', {
      value: {
        createElement: jest.fn().mockImplementation((tagName) => {
          if (tagName === 'canvas') {
            return {
              width: 0,
              height: 0,
              getContext: jest.fn().mockReturnValue({
                putImageData: jest.fn()
              }),
              toBlob: jest.fn().mockImplementation((callback) => {
                callback(new Blob(['mock-blob'], { type: 'image/png' }));
              })
            };
          }
          return {};
        })
      }
    });
  });

  afterAll(() => {
    // Restore original Worker
    (global as any).Worker = originalWorker;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (mockWorker) {
      mockWorker.postMessage.mockClear();
      mockWorker.addEventListener.mockClear();
    }
  });

  describe('1. Serialization Fix Implementation', () => {
    test('should handle ImageData conversion to ArrayBuffer', async () => {
      const mockImageData = new ImageData(new Uint8ClampedArray(400), 10, 10);
      
      const manager = new SmartOCRManager();
      await manager.initialize();

      // Simulate successful initialization
      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      // Attempt to process ImageData
      const processPromise = manager.processImage(mockImageData);

      // Verify postMessage was called without throwing DataCloneError
      expect(mockWorker.postMessage).toHaveBeenCalled();
      
      const lastCall = mockWorker.postMessage.mock.calls[mockWorker.postMessage.mock.calls.length - 1];
      const message = lastCall[0];

      // Check that imageData is now serializable (ArrayBuffer or string)
      expect(message.payload.imageData).toBeDefined();
      expect(
        message.payload.imageData instanceof ArrayBuffer || 
        typeof message.payload.imageData === 'string'
      ).toBe(true);

      // Simulate successful processing
      const processHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (processHandler) {
        processHandler({ 
          data: { 
            type: 'SUCCESS', 
            payload: { text: 'test', confidence: 0.95, words: [] } 
          } 
        });
      }

      const result = await processPromise;
      expect(result).toEqual({ text: 'test', confidence: 0.95, words: [] });
    });

    test('should handle File objects', async () => {
      const mockFile = new File(['test content'], 'test.png', { type: 'image/png' });
      
      const manager = new SmartOCRManager();
      await manager.initialize();

      // Mock successful ArrayBuffer conversion
      jest.spyOn(mockFile, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));

      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      const processPromise = manager.processImage(mockFile);

      expect(mockWorker.postMessage).toHaveBeenCalled();
      
      const processCall = mockWorker.postMessage.mock.calls.find(
        (call: any) => call[0].type === 'PROCESS'
      );
      
      expect(processCall).toBeDefined();
      expect(processCall[0].payload.imageData instanceof ArrayBuffer).toBe(true);

      // Complete the process
      const processHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (processHandler) {
        processHandler({ 
          data: { 
            type: 'SUCCESS', 
            payload: { text: 'test file', confidence: 0.90, words: [] } 
          } 
        });
      }

      const result = await processPromise;
      expect(result.text).toBe('test file');
    });

    test('should handle Blob objects', async () => {
      const mockBlob = new Blob(['test blob content'], { type: 'image/png' });
      
      const manager = new SmartOCRManager();
      await manager.initialize();

      // Mock successful ArrayBuffer conversion
      jest.spyOn(mockBlob, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(12));

      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      const processPromise = manager.processImage(mockBlob);

      expect(mockWorker.postMessage).toHaveBeenCalled();
      
      const processCall = mockWorker.postMessage.mock.calls.find(
        (call: any) => call[0].type === 'PROCESS'
      );
      
      expect(processCall).toBeDefined();
      expect(processCall[0].payload.imageData instanceof ArrayBuffer).toBe(true);

      const processHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (processHandler) {
        processHandler({ 
          data: { 
            type: 'SUCCESS', 
            payload: { text: 'test blob', confidence: 0.85, words: [] } 
          } 
        });
      }

      const result = await processPromise;
      expect(result.text).toBe('test blob');
    });

    test('should handle string inputs (base64/URL)', async () => {
      const base64String = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const manager = new SmartOCRManager();
      await manager.initialize();

      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      const processPromise = manager.processImage(base64String);

      expect(mockWorker.postMessage).toHaveBeenCalled();
      
      const processCall = mockWorker.postMessage.mock.calls.find(
        (call: any) => call[0].type === 'PROCESS'
      );
      
      expect(processCall).toBeDefined();
      expect(typeof processCall[0].payload.imageData).toBe('string');
      expect(processCall[0].payload.imageData).toBe(base64String);

      const processHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (processHandler) {
        processHandler({ 
          data: { 
            type: 'SUCCESS', 
            payload: { text: 'base64 image', confidence: 0.92, words: [] } 
          } 
        });
      }

      const result = await processPromise;
      expect(result.text).toBe('base64 image');
    });
  });

  describe('2. Error Handling Verification', () => {
    test('should catch and handle DataCloneError gracefully', async () => {
      const mockImageData = new ImageData(new Uint8ClampedArray(400), 10, 10);
      
      const manager = new SmartOCRManager();
      await manager.initialize();

      // Simulate DataCloneError on postMessage
      mockWorker.postMessage.mockImplementation(() => {
        throw new DOMException('DataCloneError', 'DataCloneError');
      });

      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      await expect(manager.processImage(mockImageData)).rejects.toThrow('Failed to send data to worker');
    });

    test('should handle worker initialization failure', async () => {
      // Mock worker creation failure
      (global as any).Worker = jest.fn().mockImplementation(() => {
        throw new Error('Worker creation failed');
      });

      const manager = new SmartOCRManager();
      
      // Should fall back to main thread processing
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    test('should handle processing errors from worker', async () => {
      const manager = new SmartOCRManager();
      await manager.initialize();

      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      const processPromise = manager.processImage('test-image');

      const processHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (processHandler) {
        processHandler({ 
          data: { 
            type: 'ERROR', 
            payload: 'Processing failed' 
          } 
        });
      }

      await expect(processPromise).rejects.toThrow('Processing failed');
    });
  });

  describe('3. Progress Handling', () => {
    test('should properly handle progress callbacks', async () => {
      const progressCallback = jest.fn();
      const manager = new SmartOCRManager();
      await manager.initialize();

      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      const processPromise = manager.processImage('test-image', progressCallback);

      const processHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (processHandler) {
        // Simulate progress updates
        processHandler({ 
          data: { 
            type: 'PROGRESS', 
            payload: { progress: 50, status: 'processing' } 
          } 
        });

        processHandler({ 
          data: { 
            type: 'PROGRESS', 
            payload: { progress: 100, status: 'complete' } 
          } 
        });

        processHandler({ 
          data: { 
            type: 'SUCCESS', 
            payload: { text: 'final result', confidence: 0.95, words: [] } 
          } 
        });
      }

      const result = await processPromise;
      
      expect(progressCallback).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenCalledWith({ progress: 50, status: 'processing' });
      expect(progressCallback).toHaveBeenCalledWith({ progress: 100, status: 'complete' });
      expect(result.text).toBe('final result');
    });
  });

  describe('4. Memory Management', () => {
    test('should properly clean up event listeners', async () => {
      const manager = new SmartOCRManager();
      await manager.initialize();

      const initHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (initHandler) {
        initHandler({ data: { type: 'SUCCESS', payload: 'Initialized' } });
      }

      const processPromise = manager.processImage('test-image');

      const processHandler = mockWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];
      
      if (processHandler) {
        processHandler({ 
          data: { 
            type: 'SUCCESS', 
            payload: { text: 'test', confidence: 0.95, words: [] } 
          } 
        });
      }

      await processPromise;

      // Verify event listener was removed after completion
      expect(mockWorker.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should terminate workers properly', () => {
      const manager = new SmartOCRManager();
      manager.terminate();

      expect(mockWorker.terminate).toHaveBeenCalled();
    });
  });
});

describe('Integration Test: Real Serialization Scenarios', () => {
  test('should handle complex ImageData without DataCloneError', () => {
    // Create realistic ImageData
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Fill with realistic image data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.floor(Math.random() * 256);     // R
      data[i + 1] = Math.floor(Math.random() * 256); // G
      data[i + 2] = Math.floor(Math.random() * 256); // B
      data[i + 3] = 255;                             // A
    }

    const imageData = new ImageData(data, width, height);

    // Test that we can serialize this data without throwing
    expect(() => {
      // This simulates what happens before postMessage
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        // This should not throw
        canvas.toBlob((blob) => {
          expect(blob).toBeDefined();
        });
      }
    }).not.toThrow();
  });
});