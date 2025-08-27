<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            // Enhanced logging for API errors
            if (request()->is('api/*') && !$e instanceof ValidationException) {
                Log::error('API Exception', [
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'url' => request()->url(),
                    'method' => request()->method(),
                    'ip' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                    // Avoid auth()->id() which triggers session initialization
                    'user_id' => request()->user()?->id ?? 'guest',
                ]);
            }
        });
    }

    /**
     * Render an exception into an HTTP response.
     */
    public function render($request, Throwable $e)
    {
        // Always handle API requests with JSON responses
        if ($this->shouldReturnJson($request, $e)) {
            return $this->renderApiException($request, $e);
        }

        return parent::render($request, $e);
    }

    /**
     * Determine if the request should receive a JSON response.
     */
    protected function shouldReturnJson($request, Throwable $e): bool
    {
        return $request->is('api/*') || 
               $request->expectsJson() || 
               $request->header('Accept') === 'application/json' ||
               $request->ajax() ||
               $request->wantsJson();
    }

    /**
     * Convert an authentication exception into a response.
     */
    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($this->shouldReturnJson($request, $exception)) {
            return new JsonResponse([
                'message' => 'Unauthenticated',
                'error' => 'Authentication Required',
                'code' => 'UNAUTHENTICATED',
                'details' => 'Please provide a valid authentication token'
            ], 401);
        }

        return redirect()->guest($exception->redirectTo() ?? route('login'));
    }

    /**
     * Render API exception responses with proper HTTP status codes and security.
     */
    protected function renderApiException($request, Throwable $e)
    {
        // Handle authentication exceptions - CRITICAL FIX
        if ($e instanceof AuthenticationException) {
            return new JsonResponse([
                'message' => 'Unauthenticated',
                'error' => 'Authentication Required',
                'code' => 'UNAUTHENTICATED',
                'details' => 'Please provide a valid authentication token'
            ], 401);
        }

        // Handle authorization exceptions
        if ($e instanceof AuthorizationException) {
            return new JsonResponse([
                'message' => 'Forbidden',
                'error' => 'Authorization Required',
                'code' => 'FORBIDDEN',
                'details' => 'You do not have permission to access this resource'
            ], 403);
        }

        // Handle validation exceptions
        if ($e instanceof ValidationException) {
            return new JsonResponse([
                'message' => 'Validation failed',
                'error' => 'Validation Error',
                'errors' => $e->errors(),
                'code' => 'VALIDATION_ERROR',
            ], 422);
        }

        // Handle model not found exceptions
        if ($e instanceof ModelNotFoundException) {
            return new JsonResponse([
                'message' => 'Resource not found',
                'error' => 'Not Found',
                'code' => 'RESOURCE_NOT_FOUND',
            ], 404);
        }

        // Handle 404 exceptions
        if ($e instanceof NotFoundHttpException) {
            return new JsonResponse([
                'message' => 'The requested endpoint was not found',
                'error' => 'Not Found',
                'code' => 'ENDPOINT_NOT_FOUND',
            ], 404);
        }

        // Handle method not allowed
        if ($e instanceof MethodNotAllowedHttpException) {
            return new JsonResponse([
                'message' => 'Method not allowed',
                'error' => 'Method Not Allowed',
                'code' => 'METHOD_NOT_ALLOWED',
                'allowed_methods' => $e->getHeaders()['Allow'] ?? []
            ], 405);
        }

        // Handle HTTP exceptions
        if ($e instanceof HttpException) {
            return new JsonResponse([
                'message' => $e->getMessage() ?: 'HTTP error occurred',
                'error' => Response::$statusTexts[$e->getStatusCode()] ?? 'HTTP Error',
                'code' => 'HTTP_ERROR',
            ], $e->getStatusCode());
        }

        // Handle database exceptions (hide sensitive information)
        if ($e instanceof QueryException) {
            // Log the actual database error for debugging
            Log::error('Database Error', [
                'sql' => $e->getSql(),
                'bindings' => $e->getBindings(),
                'message' => $e->getMessage(),
                'url' => $request->url(),
                // Avoid auth()->id() which triggers session initialization
                'user_id' => $request->user()?->id ?? 'guest',
            ]);

            return new JsonResponse([
                'message' => 'A database error occurred',
                'error' => 'Database Error',
                'code' => 'DATABASE_ERROR',
            ], 500);
        }

        // Get status code, defaulting to 500
        $statusCode = $this->getStatusCode($e);
        
        // Security-first error responses - NEVER expose sensitive information in production
        if (config('app.debug') && config('app.env') !== 'production') {
            return new JsonResponse([
                'message' => $e->getMessage(),
                'error' => class_basename($e),
                'code' => 'DEBUG_ERROR',
                'debug' => [
                    'exception' => get_class($e),
                    'file' => basename($e->getFile()), // Only show filename, not full path
                    'line' => $e->getLine(),
                    'trace' => collect($e->getTrace())->take(5)->map(function ($trace) {
                        return [
                            'file' => isset($trace['file']) ? basename($trace['file']) : 'unknown',
                            'line' => $trace['line'] ?? 'unknown',
                            'function' => $trace['function'] ?? 'unknown',
                        ];
                    }),
                ]
            ], $statusCode);
        }

        // Production-safe error responses
        return new JsonResponse([
            'message' => $this->getProductionMessage($statusCode, $e),
            'error' => Response::$statusTexts[$statusCode] ?? 'Server Error',
            'code' => $this->getErrorCode($statusCode),
            'timestamp' => now()->toISOString(),
            'request_id' => $request->header('X-Request-ID', uniqid()),
        ], $statusCode);
    }

    /**
     * Get appropriate status code from exception.
     */
    protected function getStatusCode(Throwable $e): int
    {
        if (method_exists($e, 'getStatusCode')) {
            return $e->getStatusCode();
        }

        if ($e instanceof AuthenticationException) {
            return 401;
        }

        if ($e instanceof AuthorizationException) {
            return 403;
        }

        return 500;
    }

    /**
     * Get production-safe error message.
     */
    protected function getProductionMessage(int $statusCode, Throwable $e): string
    {
        switch ($statusCode) {
            case 401:
                return 'Authentication required';
            case 403:
                return 'Access forbidden';
            case 404:
                return 'Resource not found';
            case 422:
                return 'Validation failed';
            case 429:
                return 'Too many requests';
            case 500:
                return 'Internal server error';
            case 502:
                return 'Bad gateway';
            case 503:
                return 'Service unavailable';
            default:
                return $statusCode >= 500 ? 'Server error occurred' : 'Client error occurred';
        }
    }

    /**
     * Get error code for response.
     */
    protected function getErrorCode(int $statusCode): string
    {
        $codes = [
            401 => 'UNAUTHENTICATED',
            403 => 'FORBIDDEN',
            404 => 'NOT_FOUND',
            422 => 'VALIDATION_ERROR',
            429 => 'TOO_MANY_REQUESTS',
            500 => 'INTERNAL_ERROR',
            502 => 'BAD_GATEWAY',
            503 => 'SERVICE_UNAVAILABLE',
        ];

        return $codes[$statusCode] ?? ($statusCode >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR');
    }
}
