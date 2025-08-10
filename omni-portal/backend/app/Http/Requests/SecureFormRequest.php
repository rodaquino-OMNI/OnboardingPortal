<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Log;

abstract class SecureFormRequest extends FormRequest
{
    /**
     * Configure the validator instance with security rules.
     *
     * @param  \Illuminate\Validation\Validator  $validator
     * @return void
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            // Apply security validation to all string inputs
            foreach ($this->all() as $key => $value) {
                if (is_string($value)) {
                    // Check for SQL injection
                    if ($this->containsSqlInjection($value)) {
                        $validator->errors()->add($key, 'The ' . $key . ' field contains invalid characters.');
                        $this->logSecurityEvent('sql_injection', $key, $value);
                    }
                    
                    // Check for XSS
                    if ($this->containsXss($value)) {
                        $validator->errors()->add($key, 'The ' . $key . ' field contains invalid content.');
                        $this->logSecurityEvent('xss', $key, $value);
                    }
                    
                    // Check for directory traversal
                    if ($this->containsDirectoryTraversal($value)) {
                        $validator->errors()->add($key, 'The ' . $key . ' field contains an invalid path.');
                        $this->logSecurityEvent('directory_traversal', $key, $value);
                    }
                }
            }
        });
    }
    
    /**
     * Check if value contains SQL injection patterns
     */
    protected function containsSqlInjection(string $value): bool
    {
        $patterns = [
            '/(\bunion\b.*\bselect\b)/i',
            '/(\bor\b\s*\d+\s*=\s*\d+)/i',
            '/(\'\s*or\s*\')/i',
            '/(--\s*$)/m',
            '/(\bexec\b|\bexecute\b)/i',
            '/(\bscript\b.*\b>)/i',
            '/(\bdrop\b.*\btable\b)/i',
            '/(\binsert\b.*\binto\b)/i',
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if value contains XSS patterns
     */
    protected function containsXss(string $value): bool
    {
        $patterns = [
            '/<script[^>]*>.*?<\/script>/si',
            '/<iframe[^>]*>.*?<\/iframe>/si',
            '/javascript:/i',
            '/on\w+\s*=/i',
            '/<img[^>]*onerror\s*=/i',
            '/<svg[^>]*onload\s*=/i',
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if value contains directory traversal patterns
     */
    protected function containsDirectoryTraversal(string $value): bool
    {
        $patterns = [
            '/\.\.\//',
            '/\.\.\\\\/',
            '/%2e%2e%2f/i',
            '/%2e%2e%5c/i',
            '/\.\.%2f/i',
            '/\.\.%5c/i',
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Log security events
     */
    protected function logSecurityEvent(string $type, string $field, string $value): void
    {
        Log::warning('Security validation failed', [
            'type' => $type,
            'field' => $field,
            'value' => substr($value, 0, 100), // Limit logged value length
            'ip' => request()->ip(),
            'user_id' => auth()->id(),
            'url' => request()->fullUrl(),
            'user_agent' => request()->userAgent(),
        ]);
    }
    
    /**
     * Sanitize input data
     */
    protected function sanitizeInput(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($value)) {
                // Remove null bytes
                $value = str_replace("\0", '', $value);
                
                // Trim whitespace
                $value = trim($value);
                
                // Remove control characters
                $value = preg_replace('/[\x00-\x1F\x7F]/', '', $value);
                
                $data[$key] = $value;
            } elseif (is_array($value)) {
                $data[$key] = $this->sanitizeInput($value);
            }
        }
        
        return $data;
    }
    
    /**
     * Get the validated and sanitized data
     */
    public function validatedAndSanitized(): array
    {
        return $this->sanitizeInput($this->validated());
    }
    
    /**
     * Get custom error messages
     */
    public function messages(): array
    {
        return [
            'no_sql_injection' => 'O campo :attribute contém caracteres inválidos.',
            'no_xss' => 'O campo :attribute contém conteúdo não permitido.',
            'no_directory_traversal' => 'O campo :attribute contém um caminho inválido.',
        ];
    }
}