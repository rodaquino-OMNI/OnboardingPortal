<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Events\HealthRiskAlert;
use App\Events\SystemAlert;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| This file is where you may define all of your Closure based console
| commands. Each Closure is bound to a command instance allowing a
| simple approach to interacting with each command's IO methods.
|
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Command to test WebSocket functionality
Artisan::command('websocket:test', function () {
    // Generate a test health alert
    $alertData = [
        'id' => 'cmd_test_' . time(),
        'type' => 'warning',
        'category' => 'health',
        'title' => 'CLI WebSocket Test',
        'message' => 'This is a test alert generated from the CLI to verify WebSocket broadcasting is working.',
        'timestamp' => now()->toISOString(),
        'priority' => 'medium',
        'resolved' => false,
        'source' => 'cli_command',
        'actionRequired' => false,
        'autoResolve' => true,
        'escalationLevel' => 0,
        'metadata' => [
            'test' => true,
            'cli' => true
        ]
    ];

    // Broadcast the alert
    broadcast(new HealthRiskAlert($alertData));
    
    $this->info('WebSocket test alert broadcasted successfully!');
    $this->line('Alert ID: ' . $alertData['id']);
    $this->line('Check your WebSocket client to see if the alert was received.');
})->purpose('Test WebSocket broadcasting via CLI');

// Command to generate multiple test alerts
Artisan::command('websocket:load-test {count=10}', function ($count) {
    $count = min($count, 100); // Safety limit
    
    $this->info("Generating {$count} test alerts...");
    
    $bar = $this->output->createProgressBar($count);
    
    for ($i = 1; $i <= $count; $i++) {
        $alertData = [
            'id' => 'load_test_' . time() . '_' . $i,
            'type' => collect(['info', 'warning', 'critical'])->random(),
            'category' => collect(['health', 'system', 'security', 'performance'])->random(),
            'title' => "Load Test Alert #{$i}",
            'message' => "This is load test message #{$i} generated from CLI command.",
            'timestamp' => now()->toISOString(),
            'priority' => collect(['low', 'medium', 'high'])->random(),
            'resolved' => false,
            'source' => 'cli_load_test',
            'actionRequired' => rand(0, 1) === 1,
            'autoResolve' => true,
            'escalationLevel' => 0,
            'metadata' => [
                'test' => true,
                'load_test' => true,
                'sequence' => $i,
                'total' => $count
            ]
        ];

        if ($alertData['category'] === 'health') {
            broadcast(new HealthRiskAlert($alertData));
        } else {
            broadcast(new SystemAlert($alertData));
        }
        
        $bar->advance();
        usleep(100000); // 100ms delay
    }
    
    $bar->finish();
    $this->newLine(2);
    $this->info("Successfully broadcasted {$count} test alerts!");
})->purpose('Generate multiple test alerts for load testing');