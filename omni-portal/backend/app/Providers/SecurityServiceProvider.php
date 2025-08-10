<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Validator;
use App\Services\DatabaseQueryValidator;

class SecurityServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Initialize database query monitoring
        if (config('security.sql_monitoring', true)) {
            DatabaseQueryValidator::initialize();
        }
        
        // Add custom validation rules
        $this->addCustomValidationRules();
        
        // Configure security headers
        $this->configureSecurityHeaders();
        
        // Configure secure cookies
        $this->configureSecureCookies();
    }
    
    /**
     * Add custom security validation rules
     */
    private function addCustomValidationRules(): void
    {
        // SQL Injection validation
        Validator::extend('no_sql_injection', function ($attribute, $value, $parameters, $validator) {
            if (!is_string($value)) {
                return true;
            }
            
            $patterns = [
                '/(\bunion\b.*\bselect\b)/i',
                '/(\bor\b\s*\d+\s*=\s*\d+)/i',
                '/(\'\s*or\s*\')/i',
                '/(--\s*$)/m',
                '/(\bexec\b|\bexecute\b)/i',
            ];
            
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $value)) {
                    return false;
                }
            }
            
            return true;
        }, 'O campo :attribute contém caracteres inválidos.');
        
        // XSS validation
        Validator::extend('no_xss', function ($attribute, $value, $parameters, $validator) {
            if (!is_string($value)) {
                return true;
            }
            
            $patterns = [
                '/<script[^>]*>.*?<\/script>/si',
                '/<iframe[^>]*>.*?<\/iframe>/si',
                '/javascript:/i',
                '/on\w+\s*=/i',
            ];
            
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $value)) {
                    return false;
                }
            }
            
            return true;
        }, 'O campo :attribute contém conteúdo não permitido.');
        
        // Directory traversal validation
        Validator::extend('no_directory_traversal', function ($attribute, $value, $parameters, $validator) {
            if (!is_string($value)) {
                return true;
            }
            
            $patterns = [
                '/\.\.\//',
                '/\.\.\\\\/',
                '/%2e%2e%2f/i',
                '/%2e%2e%5c/i',
            ];
            
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $value)) {
                    return false;
                }
            }
            
            return true;
        }, 'O campo :attribute contém um caminho inválido.');
    }
    
    /**
     * Configure security headers
     */
    private function configureSecurityHeaders(): void
    {
        // Use the existing SecurityHeaders middleware class instead of a closure
        // This prevents the "Cannot access offset of type Closure" error
        // The SecurityHeaders middleware is already added to the global middleware stack
        
        // No need to add closure here since we have SecurityHeaders middleware class
    }
    
    /**
     * Build Content Security Policy
     */
    private function buildContentSecurityPolicy(): string
    {
        $policies = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://connect.facebook.net",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://api.anthropic.com https://viacep.com.br wss://tokbox.com",
            "media-src 'self' blob:",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ];
        
        return implode('; ', $policies);
    }
    
    /**
     * Configure secure cookies
     */
    private function configureSecureCookies(): void
    {
        // Force secure cookies in production
        if (config('app.env') === 'production') {
            config(['session.secure' => true]);
            config(['session.http_only' => true]);
            config(['session.same_site' => 'strict']);
        }
    }
}