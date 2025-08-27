<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

class MetricsController extends Controller
{
    public function index(): Response
    {
        $metrics = [];
        
        // Application info
        $metrics[] = '# HELP laravel_info Laravel application information';
        $metrics[] = '# TYPE laravel_info gauge';
        $metrics[] = sprintf('laravel_info{version="%s",environment="%s"} 1', 
            config('app.version', '1.0.0'),
            app()->environment()
        );
        
        // Memory usage
        $metrics[] = '# HELP php_memory_usage_bytes Current memory usage';
        $metrics[] = '# TYPE php_memory_usage_bytes gauge';
        $metrics[] = sprintf('php_memory_usage_bytes %d', memory_get_usage(true));
        
        // OPcache metrics
        if (function_exists('opcache_get_status')) {
            $opcacheStatus = opcache_get_status(false);
            if ($opcacheStatus) {
                $metrics[] = '# HELP php_opcache_memory_used_bytes OPcache memory used';
                $metrics[] = '# TYPE php_opcache_memory_used_bytes gauge';
                $metrics[] = sprintf('php_opcache_memory_used_bytes %d', 
                    $opcacheStatus['memory_usage']['used_memory'] ?? 0
                );
            }
        }
        
        return response(implode("\n", $metrics), 200)
            ->header('Content-Type', 'text/plain; version=0.0.4');
    }
}
