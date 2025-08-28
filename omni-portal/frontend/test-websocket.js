#!/usr/bin/env node

// Simple Node.js WebSocket client test to verify Laravel Reverb is working
const WebSocket = require('ws');

console.log('🔄 Testing WebSocket connection to Laravel Reverb...');
console.log('Server: ws://localhost:8081');

const ws = new WebSocket('ws://localhost:8081/app/vra4m4ukxphhlhweav9m?protocol=7&client=js&version=8.4.0&flash=false');

ws.on('open', function open() {
    console.log('✅ Connected to Laravel Reverb WebSocket server!');
    
    // Subscribe to a channel
    const subscribeMessage = JSON.stringify({
        event: 'pusher:subscribe',
        data: {
            channel: 'health.alerts'
        }
    });
    
    console.log('📡 Subscribing to health.alerts channel...');
    ws.send(subscribeMessage);
});

ws.on('message', function message(data) {
    console.log('📨 Received message:', data.toString());
    
    try {
        const parsed = JSON.parse(data.toString());
        if (parsed.event === 'pusher:subscription_succeeded') {
            console.log('✅ Successfully subscribed to channel:', parsed.channel);
        } else if (parsed.event === 'HealthRiskAlert') {
            console.log('🚨 Received HealthRiskAlert!', parsed.data);
        } else if (parsed.event === 'SystemAlert') {
            console.log('⚠️ Received SystemAlert!', parsed.data);
        }
    } catch (error) {
        console.log('Raw message (not JSON):', data.toString());
    }
});

ws.on('close', function close() {
    console.log('❌ WebSocket connection closed');
});

ws.on('error', function error(err) {
    console.error('💥 WebSocket error:', err.message);
});

// Keep alive for 30 seconds
setTimeout(() => {
    console.log('⏰ Test timeout reached, closing connection...');
    ws.close();
    process.exit(0);
}, 30000);

console.log('⏳ Waiting for messages... (30 second timeout)');