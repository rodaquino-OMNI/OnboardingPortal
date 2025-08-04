<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Comprehensive Data Validation Middleware
 * 
 * Provides centralized validation logic for request data with:
 * - Type safety validation
 * - Security threat detection
 * - Data sanitization
 * - Custom business rules
 */
class ValidationMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $validationType = 'basic'): Response
    {
        switch ($validationType) {
            case 'registration':
                $this->validateRegistrationData($request);
                break;
            case 'profile':
                $this->validateProfileData($request);
                break;
            case 'security':
                $this->validateSecurityData($request);
                break;
            case 'file_upload':
                $this->validateFileUploadData($request);
                break;
            default:
                $this->validateBasicData($request);
                break;
        }

        return $next($request);
    }

    /**
     * Validate registration-specific data
     */
    private function validateRegistrationData(Request $request): void
    {
        // Security checks for registration
        $this->checkForSuspiciousPatterns($request);
        $this->validateCPFFormat($request);
        $this->checkEmailDomain($request);
        
        // Rate limiting specific to registration
        $this->checkRegistrationRateLimit($request);
    }

    /**
     * Validate profile update data
     */
    private function validateProfileData(Request $request): void
    {
        // Validate personal information consistency
        $this->validateDateConsistency($request);
        $this->validatePhoneNumber($request);
        $this->validateAddressData($request);
        
        // Check for data integrity
        $this->validateProfileIntegrity($request);
    }

    /**
     * Validate security-sensitive data
     */
    private function validateSecurityData(Request $request): void
    {
        // Password security validation
        $this->checkPasswordSecurity($request);
        $this->validateSecurityQuestions($request);
        
        // Authentication attempt validation
        $this->checkAuthenticationAttempts($request);
    }

    /**
     * Validate file upload data
     */
    private function validateFileUploadData(Request $request): void
    {
        // File security validation
        $this->validateFileTypes($request);
        $this->checkFileSize($request);
        $this->scanForMaliciousContent($request);
    }

    /**
     * Basic data validation
     */
    private function validateBasicData(Request $request): void
    {
        // XSS protection
        $this->sanitizeInputData($request);
        
        // SQL injection protection
        $this->checkForSQLInjection($request);
        
        // Basic format validation
        $this->validateDataTypes($request);
    }

    /**
     * Check for suspicious patterns in request data
     */
    private function checkForSuspiciousPatterns(Request $request): void
    {
        $suspiciousPatterns = [
            '/script[^>]*>.*?<\/script>/i',
            '/javascript:/i',
            '/vbscript:/i',
            '/onload/i',
            '/onerror/i',
            '/eval\(/i',
            '/expression\(/i',
        ];

        $data = $request->all();
        foreach ($data as $key => $value) {
            if (is_string($value)) {
                foreach ($suspiciousPatterns as $pattern) {
                    if (preg_match($pattern, $value)) {
                        throw ValidationException::withMessages([
                            $key => 'Dados suspeitos detectados. Por favor, verifique sua entrada.'
                        ]);
                    }
                }
            }
        }
    }

    /**
     * Validate CPF format and check digit
     */
    private function validateCPFFormat(Request $request): void
    {
        if ($request->has('cpf')) {
            $cpf = preg_replace('/[^0-9]/', '', $request->cpf);
            
            if (!$this->isValidCPF($cpf)) {
                throw ValidationException::withMessages([
                    'cpf' => 'CPF inválido. Verifique os dígitos informados.'
                ]);
            }
        }
    }

    /**
     * Validate CPF using algorithm
     */
    private function isValidCPF(string $cpf): bool
    {
        if (strlen($cpf) != 11 || preg_match('/(\d)\1{10}/', $cpf)) {
            return false;
        }

        for ($t = 9; $t < 11; $t++) {
            $d = 0;
            for ($c = 0; $c < $t; $c++) {
                $d += $cpf[$c] * (($t + 1) - $c);
            }
            $d = ((10 * $d) % 11) % 10;
            if ($cpf[$c] != $d) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check email domain for validity
     */
    private function checkEmailDomain(Request $request): void
    {
        if ($request->has('email')) {
            $email = $request->email;
            $domain = substr(strrchr($email, "@"), 1);
            
            // Block temporary/disposable email domains
            $disposableDomains = [
                '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
                'mailinator.com', 'throwaway.email'
            ];
            
            if (in_array($domain, $disposableDomains)) {
                throw ValidationException::withMessages([
                    'email' => 'Por favor, use um endereço de e-mail permanente.'
                ]);
            }
        }
    }

    /**
     * Check registration rate limiting
     */
    private function checkRegistrationRateLimit(Request $request): void
    {
        $key = 'registration_attempts:' . $request->ip();
        $attempts = cache()->get($key, 0);
        
        if ($attempts > 5) {
            throw ValidationException::withMessages([
                'rate_limit' => 'Muitas tentativas de registro. Tente novamente em 1 hora.'
            ]);
        }
        
        cache()->put($key, $attempts + 1, 3600); // 1 hour
    }

    /**
     * Validate date consistency
     */
    private function validateDateConsistency(Request $request): void
    {
        if ($request->has('birth_date') && $request->has('start_date')) {
            $birthDate = \Carbon\Carbon::parse($request->birth_date);
            $startDate = \Carbon\Carbon::parse($request->start_date);
            
            $age = $birthDate->diffInYears($startDate);
            
            if ($age < 16) {
                throw ValidationException::withMessages([
                    'start_date' => 'Data de início incompatível com a idade informada.'
                ]);
            }
        }
    }

    /**
     * Validate phone number format
     */
    private function validatePhoneNumber(Request $request): void
    {
        if ($request->has('phone')) {
            $phone = preg_replace('/[^0-9]/', '', $request->phone);
            
            if (!in_array(strlen($phone), [10, 11])) {
                throw ValidationException::withMessages([
                    'phone' => 'Número de telefone deve ter 10 ou 11 dígitos.'
                ]);
            }
            
            // Validate area code
            $areaCode = substr($phone, 0, 2);
            $validAreaCodes = [
                '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
                '21', '22', '24', // RJ
                '27', '28', // ES
                '31', '32', '33', '34', '35', '37', '38', // MG
                // Add more area codes as needed
            ];
            
            if (!in_array($areaCode, $validAreaCodes)) {
                throw ValidationException::withMessages([
                    'phone' => 'Código de área inválido.'
                ]);
            }
        }
    }

    /**
     * Validate address data consistency
     */
    private function validateAddressData(Request $request): void
    {
        if ($request->has('zip_code') && $request->has('state')) {
            $zipCode = preg_replace('/[^0-9]/', '', $request->zip_code);
            $state = strtoupper($request->state);
            
            // Basic ZIP code to state validation
            $zipCodeRanges = [
                'SP' => ['01000', '19999'],
                'RJ' => ['20000', '28999'],
                'MG' => ['30000', '39999'],
                // Add more states as needed
            ];
            
            if (isset($zipCodeRanges[$state])) {
                $min = $zipCodeRanges[$state][0];
                $max = $zipCodeRanges[$state][1];
                
                if ($zipCode < $min || $zipCode > $max) {
                    throw ValidationException::withMessages([
                        'zip_code' => 'CEP não corresponde ao estado informado.'
                    ]);
                }
            }
        }
    }

    /**
     * Validate profile data integrity
     */
    private function validateProfileIntegrity(Request $request): void
    {
        // Check for profile field consistency
        if ($request->has('emergency_contact_name') && !$request->has('emergency_contact_phone')) {
            throw ValidationException::withMessages([
                'emergency_contact_phone' => 'Telefone do contato de emergência é obrigatório quando nome é informado.'
            ]);
        }
    }

    /**
     * Check password security
     */
    private function checkPasswordSecurity(Request $request): void
    {
        if ($request->has('password')) {
            $password = $request->password;
            
            // Check against common passwords
            $commonPasswords = [
                '123456', 'password', '123456789', '12345678', '12345',
                'qwerty', 'abc123', '111111', 'password1', '1234567890'
            ];
            
            if (in_array(strtolower($password), $commonPasswords)) {
                throw ValidationException::withMessages([
                    'password' => 'Esta senha é muito comum. Escolha uma senha mais segura.'
                ]);
            }
        }
    }

    /**
     * Validate security questions
     */
    private function validateSecurityQuestions(Request $request): void
    {
        if ($request->has('security_answer')) {
            $answer = trim($request->security_answer);
            
            if (strlen($answer) < 3 || is_numeric($answer)) {
                throw ValidationException::withMessages([
                    'security_answer' => 'Resposta de segurança deve ter pelo menos 3 caracteres e não pode ser apenas números.'
                ]);
            }
        }
    }

    /**
     * Check authentication attempts
     */
    private function checkAuthenticationAttempts(Request $request): void
    {
        $key = 'auth_attempts:' . $request->ip();
        $attempts = cache()->get($key, 0);
        
        if ($attempts > 10) {
            throw ValidationException::withMessages([
                'auth' => 'Muitas tentativas de autenticação. Conta temporariamente bloqueada.'
            ]);
        }
    }

    /**
     * Validate file types
     */
    private function validateFileTypes(Request $request): void
    {
        $allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        foreach ($request->allFiles() as $key => $file) {
            if ($file && !in_array($file->getMimeType(), $allowedTypes)) {
                throw ValidationException::withMessages([
                    $key => 'Tipo de arquivo não permitido.'
                ]);
            }
        }
    }

    /**
     * Check file sizes
     */
    private function checkFileSize(Request $request): void
    {
        $maxSize = 10 * 1024 * 1024; // 10MB
        
        foreach ($request->allFiles() as $key => $file) {
            if ($file && $file->getSize() > $maxSize) {
                throw ValidationException::withMessages([
                    $key => 'Arquivo muito grande. Tamanho máximo: 10MB.'
                ]);
            }
        }
    }

    /**
     * Scan for malicious content in files
     */
    private function scanForMaliciousContent(Request $request): void
    {
        foreach ($request->allFiles() as $key => $file) {
            if ($file) {
                $content = file_get_contents($file->getRealPath());
                
                // Check for suspicious patterns in file content
                $maliciousPatterns = [
                    '/eval\s*\(/i',
                    '/exec\s*\(/i',
                    '/system\s*\(/i',
                    '/shell_exec\s*\(/i',
                    '/<script/i',
                    '/javascript:/i',
                ];
                
                foreach ($maliciousPatterns as $pattern) {
                    if (preg_match($pattern, $content)) {
                        throw ValidationException::withMessages([
                            $key => 'Arquivo contém conteúdo suspeito.'
                        ]);
                    }
                }
            }
        }
    }

    /**
     * Sanitize input data
     */
    private function sanitizeInputData(Request $request): void
    {
        $data = $request->all();
        
        foreach ($data as $key => $value) {
            if (is_string($value)) {
                // Remove potentially dangerous tags and scripts
                $value = strip_tags($value, '<p><br><strong><em><ul><ol><li>');
                $value = preg_replace('/javascript:/i', '', $value);
                $value = preg_replace('/vbscript:/i', '', $value);
                
                $request->merge([$key => $value]);
            }
        }
    }

    /**
     * Check for SQL injection patterns
     */
    private function checkForSQLInjection(Request $request): void
    {
        $sqlPatterns = [
            '/(\s|^)(union|select|insert|update|delete|drop|create|alter|exec|execute)\s/i',
            '/(\s|^)(or|and)\s+\d+\s*=\s*\d+/i',
            "/(\s|^)(or|and)\s+'[^']*'\s*=\s*'[^']*'/i",
            '/(\s|^)(or|and)\s+true/i',
            '/(\s|^)(or|and)\s+false/i',
        ];
        
        $data = $request->all();
        foreach ($data as $key => $value) {
            if (is_string($value)) {
                foreach ($sqlPatterns as $pattern) {
                    if (preg_match($pattern, $value)) {
                        throw ValidationException::withMessages([
                            $key => 'Padrão de entrada suspeito detectado.'
                        ]);
                    }
                }
            }
        }
    }

    /**
     * Validate data types
     */
    private function validateDataTypes(Request $request): void
    {
        // Ensure numeric fields are actually numeric
        $numericFields = ['employee_id', 'phone', 'zip_code', 'cpf'];
        
        foreach ($numericFields as $field) {
            if ($request->has($field) && !is_numeric(preg_replace('/[^0-9]/', '', $request->$field))) {
                throw ValidationException::withMessages([
                    $field => "Campo $field deve conter apenas números."
                ]);
            }
        }
    }
}