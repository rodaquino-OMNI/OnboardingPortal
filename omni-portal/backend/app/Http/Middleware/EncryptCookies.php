<?php

namespace App\Http\Middleware;

use Illuminate\Cookie\Middleware\EncryptCookies as Middleware;

class EncryptCookies extends Middleware
{
    /**
     * The names of the cookies that should not be encrypted.
     *
     * @var array<int, string>
     */
    protected $except = [
        'XSRF-TOKEN', // Sanctum needs this unencrypted for JavaScript access
        'auth_token', // Custom auth token should not be encrypted
    ];
}