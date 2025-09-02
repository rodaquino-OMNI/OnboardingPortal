<?php

namespace App\Exceptions;

use App\Http\Middleware\RequestIDMiddleware;
use App\Support\RequestTraceHelper;
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
            // Use RequestTraceHelper for enhanced logging with request correlation
            try {
                if (app()->runningInConsole()) {
                    // Log console exceptions without request context
                    Log::error('Console Exception', [
                        'exception' => get_class($e),
                        'message' => $e->getMessage(),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                    ]);
                    return;
                }
                
                // Use RequestTraceHelper for request-aware logging
                RequestTraceHelper::logException($e, 'Exception reported via global handler');
                
            } catch (\Exception $requestException) {
                // Fallback logging without request context
                Log::error('Exception (no request context)', [
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'logging_error' => $requestException->getMessage(),
                ]);
            }
        });
    }

    /**
     * Render an exception into an HTTP response.
     */
    public function render($request, Throwable $e)
    {
        // Get request ID for correlation
        $requestId = RequestIDMiddleware::getRequestId($request) ?? 'unknown';

        // Always handle API requests with JSON responses
        if ($this->shouldReturnJson($request, $e)) {
            return $this->renderApiException($request, $e, $requestId);
        }

        // Add request ID to view data for web requests
        if ($request->isMethod('GET')) {
            $request->merge(['__request_id' => $requestId]);
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
        $requestId = RequestIDMiddleware::getRequestId($request) ?? 'unknown';
        
        if ($this->shouldReturnJson($request, $exception)) {
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'Authentication required. Please provide a valid authentication token.',
                    'request_id' => $requestId,
                    'timestamp' => now()->toISOString(),
                ]
            ], 401, [
                RequestIDMiddleware::REQUEST_ID_HEADER => $requestId,
            ]);
        }

        return redirect()->guest($exception->redirectTo() ?? route('login'));
    }

    /**
     * Render API exception responses with proper HTTP status codes and security.
     */
    protected function renderApiException($request, Throwable $e, string $requestId)
    {
        $statusCode = $this->getStatusCode($e);
        $errorCode = $this->getErrorCode($statusCode);

        // Log the error with request context using RequestTraceHelper
        RequestTraceHelper::error('API Exception', [
            'exception_class' => get_class($e),
            'status_code' => $statusCode,
            'error_code' => $errorCode,
        ], $request);

        // Handle validation exceptions with detailed errors
        if ($e instanceof ValidationException) {
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'The given data was invalid.',
                    'request_id' => $requestId,
                    'timestamp' => now()->toISOString(),
                ],
                'errors' => $e->errors(),
            ], 422, [
                RequestIDMiddleware::REQUEST_ID_HEADER => $requestId,
            ]);
        }

        // Handle database exceptions (hide sensitive information)
        if ($e instanceof QueryException) {
            // Log detailed database error for debugging
            RequestTraceHelper::error('Database Error', [
                'sql' => $e->getSql(),
                'bindings' => $e->getBindings(),
                'original_message' => $e->getMessage(),
            ], $request);

            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'DATABASE_ERROR',
                    'message' => 'A database error occurred. Please try again later.',
                    'request_id' => $requestId,
                    'timestamp' => now()->toISOString(),
                ]
            ], 500, [
                RequestIDMiddleware::REQUEST_ID_HEADER => $requestId,
            ]);
        }

        // Create standardized error response
        $errorResponse = [
            'success' => false,
            'error' => [
                'code' => $errorCode,
                'message' => $this->getExceptionMessage($e),
                'request_id' => $requestId,
                'timestamp' => now()->toISOString(),
            ],
        ];

        // Add debug information in development
        if (config('app.debug') && config('app.env') !== 'production') {
            $errorResponse['debug'] = [
                'exception' => get_class($e),
                'file' => basename($e->getFile()),
                'line' => $e->getLine(),
                'trace' => collect($e->getTrace())->take(10)->map(function ($trace) {
                    return [
                        'file' => isset($trace['file']) ? basename($trace['file']) : 'unknown',
                        'line' => $trace['line'] ?? 'unknown',
                        'function' => $trace['function'] ?? 'unknown',
                    ];
                })->toArray(),
            ];
        }

        // Add additional context for specific exceptions
        $errorResponse = $this->addExceptionContext($errorResponse, $e);

        return new JsonResponse($errorResponse, $statusCode, [
            RequestIDMiddleware::REQUEST_ID_HEADER => $requestId,
        ]);
    }

    /**
     * Get user-friendly message for exception
     */
    protected function getExceptionMessage(Throwable $e): string
    {
        if ($e instanceof AuthenticationException) {
            return 'Authentication required. Please log in to continue.';
        }

        if ($e instanceof AuthorizationException) {
            return 'You do not have permission to perform this action.';
        }

        if ($e instanceof ModelNotFoundException) {
            return 'The requested resource was not found.';
        }

        if ($e instanceof NotFoundHttpException) {
            return 'The requested endpoint was not found.';
        }

        if ($e instanceof MethodNotAllowedHttpException) {
            return 'HTTP method not allowed for this endpoint.';
        }

        if ($e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
            return 'Too many requests. Please try again later.';
        }

        if ($e instanceof ValidationException) {
            return 'The provided data is invalid. Please check your input and try again.';
        }

        if ($e instanceof HttpException) {
            return $e->getMessage() ?: 'HTTP error occurred.';
        }

        // In production, don't expose internal error messages
        if (config('app.debug')) {
            return $e->getMessage();
        }

        return 'An unexpected error occurred. Please try again later.';
    }

    /**
     * Add additional context for specific exceptions
     */
    protected function addExceptionContext(array $errorResponse, Throwable $e): array
    {
        if ($e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
            $errorResponse['retry_after'] = $e->getHeaders()['Retry-After'] ?? null;
        }

        if ($e instanceof ModelNotFoundException) {
            $errorResponse['resource_type'] = class_basename($e->getModel());
        }

        if ($e instanceof MethodNotAllowedHttpException) {
            $errorResponse['allowed_methods'] = explode(', ', $e->getHeaders()['Allow'] ?? '');
        }

        return $errorResponse;
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
