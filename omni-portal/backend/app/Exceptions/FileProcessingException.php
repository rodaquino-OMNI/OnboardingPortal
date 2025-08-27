<?php

namespace App\Exceptions;

use Exception;

class FileProcessingException extends Exception
{
    public function __construct(string $message = "File processing failed", int $code = 0, \Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}