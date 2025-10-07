<?php

namespace App\Modules\Health\Guards;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Response API Guard Middleware
 *
 * Strips Protected Health Information (PHI) from API responses to prevent
 * accidental exposure of sensitive data in logs, monitoring tools, or client-side code.
 *
 * HIPAA Compliance: 45 CFR § 164.502(b) - Uses and Disclosures
 *
 * This middleware should be applied to all API routes that may handle PHI.
 *
 * Register in app/Http/Kernel.php:
 * ```php
 * protected $middlewareGroups = [
 *     'api' => [
 *         ...
 *         \App\Modules\Health\Guards\ResponseAPIGuard::class,
 *     ],
 * ];
 * ```
 */
class ResponseAPIGuard
{
    /**
     * List of PHI fields to strip from responses
     *
     * These fields contain PHI and should never be returned in API responses
     * unless explicitly required and authorized.
     */
    private const PHI_FIELDS = [
        // Encrypted PHI data
        'answers_encrypted_json',
        'encrypted_data',
        'encrypted_answers',

        // Hash values (can be used for re-identification)
        'answers_hash',
        'data_hash',

        // Direct identifiers
        'patient_name',
        'first_name',
        'last_name',
        'email',
        'phone',
        'phone_number',
        'dob',
        'date_of_birth',
        'ssn',
        'social_security_number',
        'mrn',
        'medical_record_number',

        // Address information
        'address',
        'street_address',
        'city',
        'state',
        'zip_code',
        'postal_code',
        'country',
        'latitude',
        'longitude',
        'coordinates',

        // Medical information
        'diagnosis',
        'diagnoses',
        'condition',
        'conditions',
        'medication',
        'medications',
        'allergies',
        'symptoms',
        'treatment',
        'procedure',
        'lab_results',
        'test_results',

        // Authentication/Session data
        'password',
        'password_hash',
        'remember_token',
        'api_token',
        'session_token',

        // Internal metadata that could aid re-identification
        'ip_address',
        'user_agent',
        'device_fingerprint'
    ];

    /**
     * List of routes/patterns that should bypass PHI stripping
     *
     * These routes are explicitly authorized to return PHI
     * (e.g., authenticated healthcare provider dashboard)
     */
    private const BYPASS_ROUTES = [
        'api/admin/health/*',           // Admin health data access
        'api/provider/patient/*',       // Provider patient access
        'api/user/profile/phi',         // User's own PHI access
    ];

    /**
     * Handle an incoming request
     *
     * @param Request $request
     * @param Closure $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Only process JSON responses
        if (!$response instanceof JsonResponse) {
            return $response;
        }

        // Check if route should bypass PHI stripping
        if ($this->shouldBypass($request)) {
            if (function_exists('logger')) {
                logger()->info('PHI_GUARD_BYPASSED', [
                    'route' => $request->path(),
                    'user_id' => $request->user()?->id,
                    'timestamp' => date('c')
                ]);
            }
            return $response;
        }

        // Get response data as array
        $data = $response->getData(true);

        // Strip PHI from response
        $sanitized = $this->stripPHI($data);

        // Update response with sanitized data
        $response->setData($sanitized);

        // Add security header indicating PHI was stripped
        $response->header('X-PHI-Stripped', 'true');

        // Log PHI stripping for audit
        if (function_exists('logger')) {
            logger()->info('PHI_STRIPPED_FROM_RESPONSE', [
                'route' => $request->path(),
                'fields_stripped' => $this->getStrippedFields($data, $sanitized),
                'timestamp' => date('c')
            ]);
        }

        return $response;
    }

    /**
     * Check if current request should bypass PHI stripping
     *
     * @param Request $request
     * @return bool
     */
    private function shouldBypass(Request $request): bool
    {
        $path = $request->path();

        foreach (self::BYPASS_ROUTES as $pattern) {
            // Convert wildcard pattern to regex
            $regex = '#^' . str_replace('*', '.*', $pattern) . '$#';

            if (preg_match($regex, $path)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Recursively strip PHI fields from data array
     *
     * @param array $data Response data
     * @return array Sanitized data
     */
    private function stripPHI(array $data): array
    {
        $sanitized = [];

        foreach ($data as $key => $value) {
            // Skip PHI fields
            if (in_array($key, self::PHI_FIELDS)) {
                continue;
            }

            // Recursively process nested arrays
            if (is_array($value)) {
                $sanitized[$key] = $this->stripPHI($value);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }

    /**
     * Get list of fields that were stripped
     *
     * @param array $original Original data
     * @param array $sanitized Sanitized data
     * @return array List of stripped field names
     */
    private function getStrippedFields(array $original, array $sanitized): array
    {
        $stripped = [];

        foreach ($original as $key => $value) {
            if (!array_key_exists($key, $sanitized)) {
                $stripped[] = $key;
            } elseif (is_array($value) && is_array($sanitized[$key])) {
                $nested = $this->getStrippedFields($value, $sanitized[$key]);
                foreach ($nested as $nestedKey) {
                    $stripped[] = "{$key}.{$nestedKey}";
                }
            }
        }

        return $stripped;
    }

    /**
     * Get list of PHI fields that will be stripped
     *
     * @return array
     */
    public static function getPHIFields(): array
    {
        return self::PHI_FIELDS;
    }

    /**
     * Get list of bypass routes
     *
     * @return array
     */
    public static function getBypassRoutes(): array
    {
        return self::BYPASS_ROUTES;
    }
}
