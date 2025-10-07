<?php

namespace App\Modules\Health\Exceptions;

use RuntimeException;

/**
 * Exception thrown when PHI data is detected in unauthorized contexts
 *
 * This exception is critical for HIPAA compliance and should trigger
 * immediate security alerts when thrown in production.
 */
class PHILeakException extends RuntimeException
{
    /**
     * Create a new PHI leak exception
     *
     * @param string $message The error message describing the leak
     * @param int $code The error code (default: 0)
     * @param \Throwable|null $previous Previous exception for chaining
     */
    public function __construct(
        string $message = "PHI data leak detected",
        int $code = 0,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $code, $previous);

        // Log critical security event
        if (function_exists('logger')) {
            logger()->critical('PHI_LEAK_DETECTED', [
                'message' => $message,
                'trace' => $this->getTraceAsString(),
                'timestamp' => date('c')
            ]);
        }
    }

    /**
     * Get the HTTP status code for this exception
     *
     * @return int
     */
    public function getStatusCode(): int
    {
        return 500; // Internal server error - never expose PHI leak details to client
    }
}
