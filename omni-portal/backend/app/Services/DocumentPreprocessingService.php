<?php

namespace App\Services;

use Intervention\Image\Facades\Image;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DocumentPreprocessingService
{
    /**
     * Optimize document for Textract processing
     */
    public function optimizeForTextract(string $filePath): string
    {
        try {
            $image = Image::make($filePath);
            
            // Get original dimensions
            $width = $image->width();
            $height = $image->height();
            
            // Optimize dimensions (max 2048x2048 for cost efficiency)
            if ($width > 2048 || $height > 2048) {
                $image->resize(2048, 2048, function ($constraint) {
                    $constraint->aspectRatio();
                    $constraint->upsize();
                });
            }
            
            // Enhance contrast for better OCR
            $image->contrast(10);
            
            // Sharpen for text clarity
            $image->sharpen(5);
            
            // Convert to grayscale for simpler processing
            $image->greyscale();
            
            // Save optimized image
            $optimizedPath = $this->getOptimizedPath($filePath);
            $image->save($optimizedPath, 85);
            
            Log::info('Document optimized for Textract', [
                'original' => $filePath,
                'optimized' => $optimizedPath,
                'original_size' => filesize($filePath),
                'optimized_size' => filesize($optimizedPath)
            ]);
            
            return $optimizedPath;
            
        } catch (\Exception $e) {
            Log::error('Document preprocessing failed', [
                'error' => $e->getMessage(),
                'file' => $filePath
            ]);
            
            // Return original if optimization fails
            return $filePath;
        }
    }
    
    /**
     * Detect if document has table structure
     */
    public function hasTableStructure(string $filePath): bool
    {
        try {
            // Simple heuristic: detect horizontal and vertical lines
            $image = Image::make($filePath);
            
            // Convert to grayscale for analysis
            $image->greyscale();
            
            // This is a simplified check - in production, use more sophisticated detection
            // For now, return false as default
            return false;
            
        } catch (\Exception $e) {
            return false;
        }
    }
    
    /**
     * Get optimized file path
     */
    private function getOptimizedPath(string $originalPath): string
    {
        $info = pathinfo($originalPath);
        return $info['dirname'] . '/' . $info['filename'] . '_optimized.' . $info['extension'];
    }
}