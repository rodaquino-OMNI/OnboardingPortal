'use client';

import { useState, useEffect } from 'react';
import { authDiag } from '@/lib/auth-diagnostics';

export function AuthDebugPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPaused, setPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      const allEvents = authDiag.getEvents();
      setEvents([...allEvents]);
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused]);

  const clearEvents = () => {
    authDiag.clear();
    setEvents([]);
  };

  const copyToClipboard = () => {
    const report = authDiag.getReport();
    navigator.clipboard.writeText(report);
    alert('Report copied to clipboard!');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 z-[9999]"
      >
        🔍 Auth Debug ({events.length})
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-[600px] max-h-[400px] bg-white border-2 border-gray-300 rounded-lg shadow-2xl z-[9999] flex flex-col">
      <div className="p-3 bg-gray-100 border-b flex items-center justify-between">
        <h3 className="font-bold text-sm">Auth Debug Panel</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setPaused(!isPaused)}
            className={`px-2 py-1 text-xs rounded ${isPaused ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={clearEvents}
            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
          >
            Clear
          </button>
          <button
            onClick={copyToClipboard}
            className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Copy Report
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No events captured yet</div>
        ) : (
          events.slice(-50).reverse().map((event: any, i) => {
            const time = new Date(event.timestamp).toLocaleTimeString();
            const colorMap: Record<string, string> = {
              'REDIRECT': 'bg-red-100 border-red-300 text-red-900',
              'AUTH_CHECK': 'bg-blue-100 border-blue-300 text-blue-900',
              'STATE_CHANGE': 'bg-green-100 border-green-300 text-green-900',
              'COOKIE_CHECK': 'bg-orange-100 border-orange-300 text-orange-900',
              'API_CALL': 'bg-purple-100 border-purple-300 text-purple-900',
              'ERROR': 'bg-red-200 border-red-400 text-red-900',
              'MOUNT': 'bg-gray-100 border-gray-300 text-gray-900',
              'AUTH_MONITOR': 'bg-yellow-100 border-yellow-300 text-yellow-900'
            };
            const color = colorMap[event.type] || 'bg-gray-100 border-gray-300';
            
            return (
              <div key={`${event.timestamp}-${i}`} className={`mb-1 p-2 border rounded ${color}`}>
                <div className="flex justify-between items-start">
                  <span className="font-bold">{time}</span>
                  <span className="font-semibold">{event.type}</span>
                </div>
                <div className="text-gray-700">{event.location}</div>
                <div className="mt-1 text-xs break-all">
                  {typeof event.data === 'object' 
                    ? JSON.stringify(event.data, null, 2)
                    : event.data}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}