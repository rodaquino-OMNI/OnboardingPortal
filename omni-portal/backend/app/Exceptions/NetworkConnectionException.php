<?php

namespace App\Exceptions;

use Exception;

class NetworkConnectionException extends Exception
{
    public function __construct(string $message = "Network connection failed", int $code = 0, \Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}