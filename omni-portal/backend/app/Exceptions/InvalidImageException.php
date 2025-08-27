<?php

namespace App\Exceptions;

use Exception;

class InvalidImageException extends Exception
{
    public function __construct(string $message = "Invalid image format", int $code = 0, \Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}