<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Simple broadcast test without events
echo "Testing WebSocket broadcasting...\n";

$broadcasting = app('Illuminate\Broadcasting\BroadcastManager');
$channel = 'public.alerts';
$event = 'test.message';
$data = [
    'message' => 'WebSocket test successful!',
    'timestamp' => date('Y-m-d H:i:s'),
    'test_id' => uniqid()
];

echo "Broadcasting to channel: $channel\n";
echo "Event: $event\n";
echo "Data: " . json_encode($data) . "\n";

try {
    $broadcasting->connection()->broadcast(
        [$channel],
        $event,
        $data
    );
    echo "✅ Broadcast sent successfully!\n";
} catch (Exception $e) {
    echo "❌ Broadcast failed: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}

echo "Check your WebSocket client for the message.\n";