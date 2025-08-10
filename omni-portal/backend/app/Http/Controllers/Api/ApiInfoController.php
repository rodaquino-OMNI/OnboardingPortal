<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;

class ApiInfoController extends Controller
{
    /**
     * Return API information and available endpoints
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'name' => config('app.name') . ' API',
            'version' => 'v1',
            'status' => 'online',
            'documentation' => '/api/docs',
            'endpoints' => [
                'health' => '/api/health',
                'status' => '/api/status',
                'auth' => [
                    'login' => '/api/auth/login',
                    'register' => '/api/auth/register',
                    'user' => '/api/auth/user',
                ],
                'csrf' => '/sanctum/csrf-cookie',
            ],
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Health check endpoint with detailed status
     */
    public function health(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'cache' => $this->checkCache(),
            'session' => $this->checkSession(),
            'storage' => $this->checkStorage(),
        ];

        $healthy = !in_array(false, $checks, true);

        return response()->json([
            'status' => $healthy ? 'healthy' : 'degraded',
            'checks' => $checks,
            'timestamp' => now()->toIso8601String(),
        ], $healthy ? 200 : 503);
    }

    private function checkDatabase(): bool
    {
        try {
            \DB::connection()->getPdo();
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    private function checkCache(): bool
    {
        try {
            cache()->put('health_check', true, 1);
            return cache()->get('health_check') === true;
        } catch (\Exception $e) {
            return false;
        }
    }

    private function checkSession(): bool
    {
        try {
            // For API routes, just check if session driver is configured
            $driver = config('session.driver');
            return !empty($driver) && $driver !== 'array';
        } catch (\Exception $e) {
            return false;
        }
    }

    private function checkStorage(): bool
    {
        try {
            $path = storage_path('app/health_check.tmp');
            file_put_contents($path, 'test');
            $result = file_get_contents($path) === 'test';
            unlink($path);
            return $result;
        } catch (\Exception $e) {
            return false;
        }
    }
}