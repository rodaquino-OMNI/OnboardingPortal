const WebSocket = require('ws');

// Test WebSocket connection to Laravel Reverb
const wsUrl = 'ws://localhost:8080/app/vra4m4ukxphhlhweav9m?protocol=7&client=js&version=8.4.0-rc2&flash=false';

console.log('🔌 Attempting WebSocket connection to:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
    console.log('✅ WebSocket connection established!');
    
    // Subscribe to health alerts channel
    const subscribeMessage = JSON.stringify({
        event: 'pusher:subscribe',
        data: {
            auth: '',
            channel: 'public.alerts'
        }
    });
    
    console.log('📡 Subscribing to public.alerts channel...');
    ws.send(subscribeMessage);
});

ws.on('message', function message(data) {
    console.log('📨 Received message:', data.toString());
    try {
        const parsed = JSON.parse(data.toString());
        console.log('📋 Parsed message:', JSON.stringify(parsed, null, 2));
    } catch (e) {
        console.log('📄 Raw message:', data.toString());
    }
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
    console.log('🔴 WebSocket connection closed:', code, reason.toString());
});

// Keep the connection alive for testing
setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
    process.exit(0);
}, 15000);