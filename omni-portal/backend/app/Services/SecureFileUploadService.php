<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Exception;
use App\Exceptions\FileProcessingException;
use App\Exceptions\InvalidImageException;

class SecureFileUploadService
{
    /**
     * Magic number signatures for file type validation
     */
    private const FILE_SIGNATURES = [
        'jpg' => ['FFD8FF', 'FFD8FFE0', 'FFD8FFE1', 'FFD8FFDB'],
        'jpeg' => ['FFD8FF', 'FFD8FFE0', 'FFD8FFE1', 'FFD8FFDB'],
        'png' => ['89504E47'],
        'pdf' => ['25504446'],
        'txt' => null, // Text files don't have consistent signatures
    ];
    
    /**
     * Dangerous file patterns to detect
     */
    private const DANGEROUS_PATTERNS = [
        'php' => ['<?php', '<script', '<%', '<? '],
        'javascript' => ['<script', 'javascript:', 'onerror=', 'onclick='],
        'executable' => ['MZ', '4D5A'], // PE executables
        'shell' => ['#!/bin/bash', '#!/bin/sh', '#!/usr/bin/env'],
        'server_side' => ['<%@', '<?=', '<?php', '<%'],
    ];
    
    /**
     * Maximum file sizes by type (in bytes)
     */
    private const MAX_FILE_SIZES = [
        'jpg' => 5 * 1024 * 1024,  // 5MB
        'jpeg' => 5 * 1024 * 1024, // 5MB
        'png' => 5 * 1024 * 1024,  // 5MB
        'pdf' => 10 * 1024 * 1024, // 10MB
        'txt' => 1 * 1024 * 1024,  // 1MB
    ];
    
    /**
     * Allowed MIME types with strict mapping
     */
    private const ALLOWED_MIME_TYPES = [
        'jpg' => ['image/jpeg', 'image/jpg'],
        'jpeg' => ['image/jpeg', 'image/jpg'],
        'png' => ['image/png'],
        'pdf' => ['application/pdf'],
        'txt' => ['text/plain'],
    ];
    
    /**
     * Validate and process uploaded file
     */
    public function validateAndProcess(UploadedFile $file, string $type, int $beneficiaryId): array
    {
        // 1. Validate file extension
        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, array_keys(self::ALLOWED_MIME_TYPES))) {
            throw new Exception('Invalid file extension: ' . $extension);
        }
        
        // 2. Validate MIME type
        $mimeType = $file->getMimeType();
        if (!in_array($mimeType, self::ALLOWED_MIME_TYPES[$extension])) {
            throw new Exception('Invalid MIME type for extension ' . $extension . ': ' . $mimeType);
        }
        
        // 3. Validate file size
        if ($file->getSize() > self::MAX_FILE_SIZES[$extension]) {
            throw new Exception('File size exceeds maximum allowed for ' . $extension);
        }
        
        // 4. Validate file signature (magic numbers)
        if (!$this->validateFileSignature($file, $extension)) {
            throw new Exception('File content does not match extension');
        }
        
        // 5. Scan for dangerous content
        if ($this->containsDangerousContent($file)) {
            throw new Exception('File contains potentially dangerous content');
        }
        
        // 6. For images, validate image integrity
        if (in_array($extension, ['jpg', 'jpeg', 'png'])) {
            if (!$this->validateImageIntegrity($file)) {
                throw new Exception('Invalid or corrupted image file');
            }
        }
        
        // 7. For PDFs, validate PDF structure
        if ($extension === 'pdf') {
            if (!$this->validatePdfStructure($file)) {
                throw new Exception('Invalid or corrupted PDF file');
            }
        }
        
        // 8. Generate secure filename
        $filename = $this->generateSecureFilename($extension, $beneficiaryId);
        
        // 9. Create secure storage path
        $storagePath = $this->createSecureStoragePath($beneficiaryId);
        
        // 10. Store file securely
        $finalPath = $this->storeFileSecurely($file, $storagePath, $filename);
        
        // 11. Set proper permissions
        $this->setSecurePermissions($finalPath);
        
        return [
            'filename' => $filename,
            'path' => $finalPath,
            'extension' => $extension,
            'mime_type' => $mimeType,
            'size' => $file->getSize(),
            'hash' => hash_file('sha256', $file->getRealPath()),
        ];
    }
    
    /**
     * Validate file signature (magic numbers)
     */
    private function validateFileSignature(UploadedFile $file, string $extension): bool
    {
        // Text files don't have consistent signatures
        if ($extension === 'txt') {
            return $this->isValidTextFile($file);
        }
        
        $signatures = self::FILE_SIGNATURES[$extension] ?? [];
        if (empty($signatures)) {
            return false;
        }
        
        $handle = fopen($file->getRealPath(), 'rb');
        if (!$handle) {
            return false;
        }
        
        $header = fread($handle, 8);
        fclose($handle);
        
        $headerHex = strtoupper(bin2hex($header));
        
        foreach ($signatures as $signature) {
            if (strpos($headerHex, $signature) === 0) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if file contains dangerous content
     */
    private function containsDangerousContent(UploadedFile $file): bool
    {
        $content = file_get_contents($file->getRealPath());
        
        // Check for null bytes (common in attacks)
        if (strpos($content, "\0") !== false) {
            Log::warning('Null byte detected in uploaded file', [
                'filename' => $file->getClientOriginalName()
            ]);
            return true;
        }
        
        // Check for dangerous patterns
        foreach (self::DANGEROUS_PATTERNS as $type => $patterns) {
            foreach ($patterns as $pattern) {
                if (stripos($content, $pattern) !== false) {
                    Log::warning('Dangerous pattern detected in uploaded file', [
                        'filename' => $file->getClientOriginalName(),
                        'pattern_type' => $type,
                        'pattern' => $pattern
                    ]);
                    return true;
                }
            }
        }
        
        // Check for polyglot files (files that are valid in multiple formats)
        if ($this->isPolyglotFile($content)) {
            Log::warning('Polyglot file detected', [
                'filename' => $file->getClientOriginalName()
            ]);
            return true;
        }
        
        // Check for EXIF data in images that might contain PHP
        if ($this->hasExecutableExifData($file)) {
            Log::warning('Executable EXIF data detected', [
                'filename' => $file->getClientOriginalName()
            ]);
            return true;
        }
        
        return false;
    }
    
    /**
     * Validate image integrity
     */
    private function validateImageIntegrity(UploadedFile $file): bool
    {
        try {
            $imageInfo = getimagesize($file->getRealPath());
            if ($imageInfo === false) {
                Log::error('Failed to get image size information', [
                    'file' => $file->getClientOriginalName(),
                    'path' => $file->getRealPath()
                ]);
                throw new InvalidImageException('Unable to read image size information');
            }
            
            // Verify dimensions are reasonable
            if ($imageInfo[0] > 10000 || $imageInfo[1] > 10000) {
                Log::warning('Image dimensions too large', [
                    'width' => $imageInfo[0],
                    'height' => $imageInfo[1]
                ]);
                return false;
            }
            
            // Try to load the image to verify it's not corrupted
            $extension = strtolower($file->getClientOriginalExtension());
            $image = null;
            
            switch ($extension) {
                case 'jpg':
                case 'jpeg':
                    $image = @imagecreatefromjpeg($file->getRealPath());
                    break;
                case 'png':
                    $image = @imagecreatefrompng($file->getRealPath());
                    break;
            }
            
            if ($image === false) {
                return false;
            }
            
            imagedestroy($image);
            return true;
            
        } catch (\Exception $e) {
            Log::error('Image validation error', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
    
    /**
     * Validate PDF structure
     */
    private function validatePdfStructure(UploadedFile $file): bool
    {
        try {
            $content = file_get_contents($file->getRealPath());
            
            // Check PDF header
            if (strpos($content, '%PDF-') !== 0) {
                return false;
            }
            
            // Check for EOF marker
            if (strpos($content, '%%EOF') === false) {
                return false;
            }
            
            // Check for embedded JavaScript or executable content
            $dangerousPdfPatterns = [
                '/\/JS\s*\(/i',
                '/\/JavaScript\s*\(/i',
                '/\/Launch\s*\(/i',
                '/\/EmbeddedFile/i',
                '/\/XFA\s*\[/i',
            ];
            
            foreach ($dangerousPdfPatterns as $pattern) {
                if (preg_match($pattern, $content)) {
                    Log::warning('Dangerous PDF pattern detected', [
                        'pattern' => $pattern
                    ]);
                    return false;
                }
            }
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('PDF validation error', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
    
    /**
     * Check if file is a valid text file
     */
    private function isValidTextFile(UploadedFile $file): bool
    {
        $content = file_get_contents($file->getRealPath());
        
        // Check if content is valid UTF-8
        if (!mb_check_encoding($content, 'UTF-8')) {
            return false;
        }
        
        // Check for binary content
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $content)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check for polyglot files
     */
    private function isPolyglotFile(string $content): bool
    {
        // Check for files that start with valid image headers but contain PHP
        $imageHeaders = ['FFD8FF', '89504E47', '47494638'];
        $contentHex = bin2hex(substr($content, 0, 4));
        
        foreach ($imageHeaders as $header) {
            if (strpos($contentHex, $header) === 0) {
                // Check if file also contains PHP tags
                if (stripos($content, '<?php') !== false || 
                    stripos($content, '<?=') !== false ||
                    stripos($content, '<%') !== false) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check for executable EXIF data
     */
    private function hasExecutableExifData(UploadedFile $file): bool
    {
        if (!in_array(strtolower($file->getClientOriginalExtension()), ['jpg', 'jpeg'])) {
            return false;
        }
        
        try {
            $exif = @exif_read_data($file->getRealPath());
            if ($exif === false) {
                return false;
            }
            
            // Check all EXIF fields for suspicious content
            foreach ($exif as $key => $value) {
                if (is_string($value)) {
                    if (stripos($value, '<?php') !== false ||
                        stripos($value, '<script') !== false ||
                        stripos($value, 'eval(') !== false) {
                        return true;
                    }
                }
            }
            
            return false;
            
        } catch (\Exception $e) {
            // If we can't read EXIF data, assume it's safe
            return false;
        }
    }
    
    /**
     * Generate secure filename
     */
    private function generateSecureFilename(string $extension, int $beneficiaryId): string
    {
        // Generate random filename to prevent enumeration
        $randomName = Str::random(32);
        $timestamp = time();
        
        return sprintf(
            '%d_%s_%s.%s',
            $beneficiaryId,
            $timestamp,
            $randomName,
            $extension
        );
    }
    
    /**
     * Create secure storage path
     */
    private function createSecureStoragePath(int $beneficiaryId): string
    {
        // Use nested directories to prevent directory listing attacks
        $hash = md5($beneficiaryId);
        $dir1 = substr($hash, 0, 2);
        $dir2 = substr($hash, 2, 2);
        
        $path = "documents/{$dir1}/{$dir2}/{$beneficiaryId}";
        $fullPath = storage_path('app/' . $path);
        
        if (!file_exists($fullPath)) {
            mkdir($fullPath, 0750, true);
        }
        
        return $path;
    }
    
    /**
     * Store file securely
     */
    private function storeFileSecurely(UploadedFile $file, string $path, string $filename): string
    {
        $fullPath = storage_path('app/' . $path . '/' . $filename);
        
        // Move file to secure location
        $file->move(storage_path('app/' . $path), $filename);
        
        // Remove execute permissions
        chmod($fullPath, 0640);
        
        return $path . '/' . $filename;
    }
    
    /**
     * Set secure permissions on uploaded file
     */
    private function setSecurePermissions(string $path): void
    {
        $fullPath = storage_path('app/' . $path);
        
        // Ensure file is not executable
        chmod($fullPath, 0640);
        
        // Add .htaccess to prevent direct access (for Apache)
        $directory = dirname($fullPath);
        $htaccessPath = $directory . '/.htaccess';
        
        if (!file_exists($htaccessPath)) {
            file_put_contents($htaccessPath, "Deny from all\n");
            chmod($htaccessPath, 0640);
        }
    }
    
    /**
     * Scan file with antivirus (if available)
     */
    public function scanWithAntivirus(string $filePath): bool
    {
        // This is a placeholder for antivirus integration
        // In production, integrate with ClamAV or similar
        
        if (config('security.antivirus_enabled', false)) {
            $command = config('security.antivirus_command', 'clamscan');
            $result = shell_exec("{$command} --no-summary {$filePath} 2>&1");
            
            if (strpos($result, 'FOUND') !== false) {
                Log::critical('Virus detected in uploaded file', [
                    'file' => $filePath,
                    'result' => $result
                ]);
                return false;
            }
        }
        
        return true;
    }
}