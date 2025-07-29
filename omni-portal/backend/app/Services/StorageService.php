<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class StorageService
{
    protected $disk;
    protected $encryptionService;

    public function __construct()
    {
        $this->disk = config('video.recording.storage_driver', 's3');
        $this->encryptionService = app(EncryptionService::class);
    }

    /**
     * Store file with optional encryption
     */
    public function store(string $path, $contents, array $options = []): bool
    {
        try {
            $encrypt = $options['encrypt'] ?? config('video.recording.encrypt_recordings', true);
            
            if ($encrypt) {
                $contents = $this->encryptionService->encrypt($contents);
                $path .= '.enc';
            }

            $visibility = $options['visibility'] ?? 'private';
            
            return Storage::disk($this->disk)->put($path, $contents, $visibility);
        } catch (\Exception $e) {
            Log::error('Storage failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Retrieve file with automatic decryption
     */
    public function get(string $path): ?string
    {
        try {
            $isEncrypted = Str::endsWith($path, '.enc');
            
            if (!Storage::disk($this->disk)->exists($path)) {
                // Try with .enc extension if not found
                if (!$isEncrypted && Storage::disk($this->disk)->exists($path . '.enc')) {
                    $path .= '.enc';
                    $isEncrypted = true;
                } else {
                    return null;
                }
            }

            $contents = Storage::disk($this->disk)->get($path);
            
            if ($isEncrypted && $contents) {
                $contents = $this->encryptionService->decrypt($contents);
            }

            return $contents;
        } catch (\Exception $e) {
            Log::error('Storage retrieval failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Delete file
     */
    public function delete(string $path): bool
    {
        try {
            // Try to delete both encrypted and non-encrypted versions
            $deleted = false;
            
            if (Storage::disk($this->disk)->exists($path)) {
                $deleted = Storage::disk($this->disk)->delete($path);
            }
            
            if (Storage::disk($this->disk)->exists($path . '.enc')) {
                $deleted = Storage::disk($this->disk)->delete($path . '.enc') || $deleted;
            }
            
            return $deleted;
        } catch (\Exception $e) {
            Log::error('Storage deletion failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if file exists
     */
    public function exists(string $path): bool
    {
        return Storage::disk($this->disk)->exists($path) || 
               Storage::disk($this->disk)->exists($path . '.enc');
    }

    /**
     * Get file URL (if public)
     */
    public function url(string $path): ?string
    {
        try {
            if ($this->disk === 'public') {
                return Storage::disk($this->disk)->url($path);
            }
            
            // Generate temporary signed URL for private files
            return $this->temporaryUrl($path, now()->addHours(1));
        } catch (\Exception $e) {
            Log::error('URL generation failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Generate temporary signed URL
     */
    public function temporaryUrl(string $path, \DateTimeInterface $expiration): ?string
    {
        try {
            if (!method_exists(Storage::disk($this->disk), 'temporaryUrl')) {
                return null;
            }
            
            return Storage::disk($this->disk)->temporaryUrl($path, $expiration);
        } catch (\Exception $e) {
            Log::error('Temporary URL generation failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get file metadata
     */
    public function metadata(string $path): array
    {
        try {
            if (!$this->exists($path)) {
                return [];
            }

            return [
                'size' => Storage::disk($this->disk)->size($path),
                'last_modified' => Storage::disk($this->disk)->lastModified($path),
                'mime_type' => Storage::disk($this->disk)->mimeType($path),
                'visibility' => Storage::disk($this->disk)->getVisibility($path),
            ];
        } catch (\Exception $e) {
            Log::error('Metadata retrieval failed: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Copy file
     */
    public function copy(string $from, string $to): bool
    {
        try {
            return Storage::disk($this->disk)->copy($from, $to);
        } catch (\Exception $e) {
            Log::error('File copy failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Move file
     */
    public function move(string $from, string $to): bool
    {
        try {
            return Storage::disk($this->disk)->move($from, $to);
        } catch (\Exception $e) {
            Log::error('File move failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * List files in directory
     */
    public function files(string $directory = null): array
    {
        try {
            return Storage::disk($this->disk)->files($directory);
        } catch (\Exception $e) {
            Log::error('Directory listing failed: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * List all files including subdirectories
     */
    public function allFiles(string $directory = null): array
    {
        try {
            return Storage::disk($this->disk)->allFiles($directory);
        } catch (\Exception $e) {
            Log::error('Recursive directory listing failed: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Create directory
     */
    public function makeDirectory(string $path): bool
    {
        try {
            return Storage::disk($this->disk)->makeDirectory($path);
        } catch (\Exception $e) {
            Log::error('Directory creation failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Delete directory
     */
    public function deleteDirectory(string $directory): bool
    {
        try {
            return Storage::disk($this->disk)->deleteDirectory($directory);
        } catch (\Exception $e) {
            Log::error('Directory deletion failed: ' . $e->getMessage());
            return false;
        }
    }
}
