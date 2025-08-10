export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  autoRotate?: boolean;
}

export async function compressImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format = 'jpeg',
    autoRotate = true,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Calculate new dimensions
        let { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );
        
        // Handle EXIF orientation
        if (autoRotate) {
          const orientation = getOrientation(file);
          const rotated = handleOrientation(canvas, ctx, img, orientation, width, height);
          width = rotated.width;
          height = rotated.height;
        } else {
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.\w+$/, `.${format}`),
                { type: `image/${format}` }
              );
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          `image/${format}`,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;
  
  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight;
  
  // Resize if needed
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

function getOrientation(file: File): number {
  // This is a simplified version. In production, you'd parse EXIF data
  // For now, return 1 (normal orientation)
  return 1;
}

function handleOrientation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  orientation: number,
  width: number,
  height: number
): { width: number; height: number } {
  // Handle different orientations
  switch (orientation) {
    case 1: // Normal
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      break;
      
    case 3: // 180 degrees
      canvas.width = width;
      canvas.height = height;
      ctx.rotate(Math.PI);
      ctx.drawImage(img, -width, -height, width, height);
      break;
      
    case 6: // 90 degrees CW
      canvas.width = height;
      canvas.height = width;
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, -height, width, height);
      return { width: height, height: width };
      
    case 8: // 90 degrees CCW
      canvas.width = height;
      canvas.height = width;
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(img, -width, 0, width, height);
      return { width: height, height: width };
      
    default:
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
  }
  
  return { width, height };
}

export async function validateImageQuality(file: File): Promise<{
  isValid: boolean;
  issues: string[];
  warnings?: string[];
  suggestions: string[];
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const issues: string[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];
        
        // Check resolution - treat as warning for mobile compatibility
        if (img.width < 400 || img.height < 300) {
          warnings.push('Resolução baixa');
          suggestions.push('Para melhor qualidade, use uma imagem com pelo menos 800x600 pixels');
        }
        
        // Check aspect ratio for documents
        const aspectRatio = img.width / img.height;
        if (aspectRatio < 0.5 || aspectRatio > 2) {
          suggestions.push('Certifique-se de capturar o documento completo');
        }
        
        // Check file size (very large files might indicate unnecessary quality)
        if (file.size > 20 * 1024 * 1024) {
          issues.push('Arquivo muito grande');
          suggestions.push('O arquivo será comprimido automaticamente');
        }
        
        resolve({
          isValid: issues.length === 0,
          issues,
          warnings,
          suggestions,
        });
      };
      
      img.onerror = () => {
        resolve({
          isValid: false,
          issues: ['Arquivo de imagem inválido'],
          suggestions: ['Verifique se o arquivo é uma imagem válida'],
        });
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  });
}

export function estimateProcessingTime(fileSize: number): number {
  // Estimate based on file size (rough approximation)
  const basetime = 2000; // 2 seconds base
  const sizeInMB = fileSize / (1024 * 1024);
  const additionalTime = sizeInMB * 500; // 500ms per MB
  
  return Math.round(basetime + additionalTime);
}