<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Jenssegers\Agent\Agent;

class LGPDAuditLogger
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $startTime = microtime(true);
        
        $response = $next($request);
        
        $endTime = microtime(true);
        $responseTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
        
        // Only log if user is authenticated
        if (Auth::check()) {
            $this->logRequest($request, $response, $responseTime);
        }
        
        return $response;
    }
    
    /**
     * Log the request for LGPD compliance
     */
    private function logRequest(Request $request, Response $response, float $responseTime): void
    {
        $user = Auth::user();
        $agent = new Agent();
        
        // Determine if this is sensitive data access
        $isSensitiveData = $this->isSensitiveDataAccess($request);
        
        // Get legal basis for data processing
        $legalBasis = $this->getLegalBasis($request);
        
        // Determine event type based on request
        $eventType = $this->getEventType($request);
        
        // Determine event category
        $eventCategory = $this->getEventCategory($request);
        
        // Determine action based on HTTP method
        $action = $this->getAction($request);
        
        // Check if user has given consent for this type of processing
        $userConsent = $this->hasUserConsent($user, $request);
        
        // Get purpose of data processing
        $purpose = $this->getPurpose($request);
        
        // Create audit log entry
        AuditLog::createLog([
            'user_id' => $user->id,
            'user_type' => 'beneficiary',
            'event_type' => $eventType,
            'event_category' => $eventCategory,
            'action' => $action,
            'request_method' => $request->method(),
            'request_url' => $request->url(),
            'request_headers' => $this->sanitizeHeaders($request->headers->all()),
            'request_body' => $this->sanitizeRequestBody($request->all()),
            'response_status' => $response->getStatusCode(),
            'response_time' => $responseTime,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'browser' => $agent->browser(),
            'browser_version' => $agent->version($agent->browser()),
            'platform' => $agent->platform(),
            'device_type' => $agent->deviceType(),
            'session_id' => session()->getId(),
            'request_id' => $request->header('X-Request-ID') ?? uniqid(),
            'is_sensitive_data' => $isSensitiveData,
            'is_successful' => $response->getStatusCode() < 400,
            'legal_basis' => $legalBasis,
            'user_consent' => $userConsent,
            'consent_timestamp' => $userConsent ? now() : null,
            'purpose' => $purpose,
            'data_classification' => $this->getDataClassification($request),
            'context' => [
                'route' => $request->route() ? $request->route()->getName() : null,
                'middleware' => $request->route() ? $request->route()->middleware() : [],
                'parameters' => $request->route() ? $request->route()->parameters() : [],
            ]
        ]);
    }
    
    /**
     * Determine if the request accesses sensitive data
     */
    private function isSensitiveDataAccess(Request $request): bool
    {
        $sensitiveEndpoints = [
            'api/profile',
            'api/lgpd',
            'api/register',
            'api/auth',
            'health-questionnaire',
            'documents',
            'interviews'
        ];
        
        foreach ($sensitiveEndpoints as $endpoint) {
            if (str_contains($request->path(), $endpoint)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Get legal basis for data processing
     */
    private function getLegalBasis(Request $request): string
    {
        $path = $request->path();
        
        // Map endpoints to legal basis
        $legalBasisMap = [
            'api/auth' => 'Execução de contrato',
            'api/profile' => 'Execução de contrato',
            'api/lgpd' => 'Direito do titular',
            'api/register' => 'Execução de contrato',
            'health-questionnaire' => 'Consentimento',
            'documents' => 'Execução de contrato',
            'interviews' => 'Execução de contrato',
            'gamification' => 'Interesse legítimo'
        ];
        
        foreach ($legalBasisMap as $endpoint => $basis) {
            if (str_contains($path, $endpoint)) {
                return $basis;
            }
        }
        
        return 'Execução de contrato';
    }
    
    /**
     * Get event type based on request
     */
    private function getEventType(Request $request): string
    {
        $path = $request->path();
        $method = $request->method();
        
        // Specific event types for LGPD endpoints
        if (str_contains($path, 'api/lgpd/export-data')) {
            return 'data_export';
        }
        
        if (str_contains($path, 'api/lgpd/delete-account')) {
            return 'account_deletion';
        }
        
        if (str_contains($path, 'api/lgpd/privacy-settings')) {
            return 'privacy_settings_update';
        }
        
        if (str_contains($path, 'api/lgpd/withdraw-consent')) {
            return 'consent_withdrawn';
        }
        
        if (str_contains($path, 'api/auth/login')) {
            return 'login';
        }
        
        if (str_contains($path, 'api/auth/logout')) {
            return 'logout';
        }
        
        if (str_contains($path, 'api/profile') && $method === 'PUT') {
            return 'profile_update';
        }
        
        if (str_contains($path, 'api/profile') && $method === 'GET') {
            return 'data_access';
        }
        
        if (str_contains($path, 'health-questionnaire')) {
            return 'health_questionnaire_submit';
        }
        
        if (str_contains($path, 'documents')) {
            return $method === 'POST' ? 'document_upload' : 'document_access';
        }
        
        if (str_contains($path, 'interviews')) {
            return 'interview_scheduled';
        }
        
        // Default event types based on HTTP method
        switch ($method) {
            case 'GET':
                return 'data_access';
            case 'POST':
                return 'data_creation';
            case 'PUT':
            case 'PATCH':
                return 'data_modification';
            case 'DELETE':
                return 'data_deletion';
            default:
                return 'unknown_action';
        }
    }
    
    /**
     * Get event category
     */
    private function getEventCategory(Request $request): string
    {
        $path = $request->path();
        
        if (str_contains($path, 'api/auth')) {
            return 'authentication';
        }
        
        if (str_contains($path, 'api/lgpd')) {
            return 'data_privacy';
        }
        
        if (str_contains($path, 'api/profile')) {
            return 'profile_management';
        }
        
        if (str_contains($path, 'health-questionnaire')) {
            return 'health_data';
        }
        
        if (str_contains($path, 'documents')) {
            return 'document_management';
        }
        
        if (str_contains($path, 'interviews')) {
            return 'hr_processes';
        }
        
        if (str_contains($path, 'gamification')) {
            return 'gamification';
        }
        
        return 'general';
    }
    
    /**
     * Get action based on HTTP method
     */
    private function getAction(Request $request): string
    {
        switch ($request->method()) {
            case 'GET':
                return 'read';
            case 'POST':
                return 'create';
            case 'PUT':
            case 'PATCH':
                return 'update';
            case 'DELETE':
                return 'delete';
            default:
                return 'unknown';
        }
    }
    
    /**
     * Check if user has given consent for this type of processing
     */
    private function hasUserConsent($user, Request $request): bool
    {
        $path = $request->path();
        $preferences = $user->preferences ?? [];
        
        // Check specific consent types
        if (str_contains($path, 'api/lgpd')) {
            return true; // User explicitly exercising LGPD rights
        }
        
        if (str_contains($path, 'health-questionnaire')) {
            return $preferences['health_data_consent'] ?? false;
        }
        
        if (str_contains($path, 'gamification')) {
            return $preferences['analytics_consent'] ?? true;
        }
        
        if (str_contains($path, 'documents')) {
            return true; // Required for employment contract
        }
        
        // Default to user's general LGPD consent
        return $user->lgpd_consent ?? false;
    }
    
    /**
     * Get purpose of data processing
     */
    private function getPurpose(Request $request): string
    {
        $path = $request->path();
        
        $purposeMap = [
            'api/auth' => 'Autenticação e autorização',
            'api/profile' => 'Gestão de perfil do usuário',
            'api/lgpd' => 'Exercício de direitos LGPD',
            'api/register' => 'Processo de cadastro',
            'health-questionnaire' => 'Avaliação de saúde ocupacional',
            'documents' => 'Gestão de documentos de RH',
            'interviews' => 'Processo seletivo interno',
            'gamification' => 'Engajamento e motivação'
        ];
        
        foreach ($purposeMap as $endpoint => $purpose) {
            if (str_contains($path, $endpoint)) {
                return $purpose;
            }
        }
        
        return 'Operação geral do sistema';
    }
    
    /**
     * Get data classification
     */
    private function getDataClassification(Request $request): string
    {
        $path = $request->path();
        
        if (str_contains($path, 'health-questionnaire')) {
            return 'restricted'; // Health data is highly sensitive
        }
        
        if (str_contains($path, 'api/lgpd')) {
            return 'restricted'; // LGPD operations are sensitive
        }
        
        if (str_contains($path, 'api/profile') || str_contains($path, 'api/auth')) {
            return 'confidential'; // Personal data
        }
        
        if (str_contains($path, 'documents')) {
            return 'confidential'; // HR documents
        }
        
        if (str_contains($path, 'interviews')) {
            return 'confidential'; // Interview data
        }
        
        return 'internal'; // Default classification
    }
    
    /**
     * Sanitize request headers for logging
     */
    private function sanitizeHeaders(array $headers): array
    {
        $sensitiveHeaders = [
            'authorization',
            'x-api-key',
            'x-auth-token',
            'cookie',
            'x-csrf-token'
        ];
        
        $sanitized = [];
        foreach ($headers as $key => $value) {
            if (in_array(strtolower($key), $sensitiveHeaders)) {
                $sanitized[$key] = '[REDACTED]';
            } else {
                $sanitized[$key] = is_array($value) ? implode(', ', $value) : $value;
            }
        }
        
        return $sanitized;
    }
    
    /**
     * Sanitize request body for logging
     */
    private function sanitizeRequestBody(array $body): array
    {
        $sensitiveFields = [
            'password',
            'current_password',
            'new_password',
            'password_confirmation',
            'cpf',
            'credit_card',
            'ssn',
            'token',
            'secret',
            'private_key'
        ];
        
        $sanitized = [];
        foreach ($body as $key => $value) {
            if (in_array(strtolower($key), $sensitiveFields)) {
                $sanitized[$key] = '[REDACTED]';
            } else {
                $sanitized[$key] = $value;
            }
        }
        
        return $sanitized;
    }
}