<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Events\HealthRiskAlert;
use App\Events\SystemAlert;

// Test Health Risk Alert Event
$healthAlert = new HealthRiskAlert([
    'userId' => 1,
    'riskLevel' => 'HIGH',
    'message' => 'Critical health risk detected - WebSocket Test',
    'timestamp' => now(),
    'data' => [
        'type' => 'cardiac_risk',
        'score' => 85,
        'recommendation' => 'Immediate medical attention required'
    ]
]);

echo "Broadcasting Health Risk Alert...\n";
broadcast($healthAlert);

// Test System Alert Event
$systemAlert = new SystemAlert([
    'type' => 'system_notification',
    'message' => 'WebSocket connectivity test successful',
    'level' => 'info',
    'timestamp' => now(),
    'data' => [
        'component' => 'websocket_test',
        'status' => 'connected'
    ]
]);

echo "Broadcasting System Alert...\n";
broadcast($systemAlert);

echo "WebSocket events broadcasted successfully!\n";
echo "Check frontend console at http://localhost:3000\n";