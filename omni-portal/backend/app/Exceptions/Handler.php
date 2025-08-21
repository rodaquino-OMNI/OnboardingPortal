<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    public function render($request, Throwable $e)
    {
        if ($request->is('api/*') || 
            $request->expectsJson() || 
            $request->header('Accept') === 'application/json' ||
            $request->ajax() ||
            $request->wantsJson()) {
            return $this->renderApiException($request, $e);
        }

        return parent::render($request, $e);
    }

    protected function renderApiException($request, Throwable $e)
    {
        if ($e instanceof \Illuminate\Validation\ValidationException) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
                'code' => 'VALIDATION_ERROR',
            ], 422);
        }

        if ($e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException) {
            return response()->json([
                'message' => 'The requested resource was not found',
                'error' => 'Not Found',
                'code' => 'NOT_FOUND',
            ], 404);
        }

        if ($e instanceof \Illuminate\Database\QueryException) {
            return response()->json([
                'message' => 'A database error occurred',
                'error' => 'Database Error',
                'code' => 'DATABASE_ERROR',
            ], 500);
        }

        $statusCode = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
        
        if (config('app.debug')) {
            return response()->json([
                'message' => $e->getMessage(),
                'error' => class_basename($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'code' => 'INTERNAL_ERROR',
            ], $statusCode);
        }

        return response()->json([
            'message' => $statusCode === 500 ? 'Internal server error' : $e->getMessage(),
            'error' => 'Server Error',
            'code' => 'SERVER_ERROR',
        ], $statusCode);
    }
}
