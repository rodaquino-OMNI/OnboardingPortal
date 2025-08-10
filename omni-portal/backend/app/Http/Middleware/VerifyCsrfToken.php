<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     *
     * @var array<int, string>
     */
    protected $except = [
        // Temporarily disable CSRF for debugging authentication issues
        'api/auth/login',
        'api/auth/logout',
        // Sanctum CSRF cookie endpoint must be excluded
        // 'sanctum/csrf-cookie' endpoint is specifically excluded
    ];
}