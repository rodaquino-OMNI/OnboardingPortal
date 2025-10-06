'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, TestTube, Plus } from 'lucide-react';
import { VideoChat } from '@onboarding-portal/ui/video/VideoChat';

interface ChatMessage {
  id: string;
  sender: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'emergency';
  encrypted: boolean;
  encryptionVerified?: boolean;
}

export default function VideoChatSandbox() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Component state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: { id: 'doctor-1', name: 'Dr. Sarah Johnson', role: 'doctor' },
      content: 'Hello! Welcome to our secure video consultation. How are you feeling today?',
      timestamp: new Date(Date.now() - 120000),
      type: 'text',
      encrypted: true,
      encryptionVerified: true,
    },
    {
      id: '2',
      sender: { id: 'system', name: 'System', role: 'moderator' },
      content: 'End-to-end encryption has been established. All messages are now fully encrypted.',
      timestamp: new Date(Date.now() - 90000),
      type: 'system',
      encrypted: true,
      encryptionVerified: true,
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [encryptionStatus, setEncryptionStatus] = useState({
    ready: true,
    verified: true,
    channelState: 'open' as 'connecting' | 'open' | 'closed',
  });
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [error, setError] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true);

  const currentUser = {
    id: 'current-user',
    name: 'You (Sandbox)',
    role: 'patient' as const,
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mock message sending
  const handleSendMessage = async (content: string, type: 'text' | 'emergency') => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: currentUser,
      content,
      timestamp: new Date(),
      type,
      encrypted: true,
      encryptionVerified: true,
    };

    setMessages(prev => [...prev, newMessage]);

    // Simulate doctor response for demo
    if (type === 'emergency') {
      setTimeout(() => {
        const emergencyResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: { id: 'doctor-1', name: 'Dr. Sarah Johnson', role: 'doctor' },
          content: 'I received your emergency alert. I\'m here to help. What\'s the urgent matter?',
          timestamp: new Date(),
          type: 'text',
          encrypted: true,
          encryptionVerified: true,
        };
        setMessages(prev => [...prev, emergencyResponse]);
      }, 1000);
    } else {
      setTimeout(() => {
        const responses = [
          'Thank you for that information. Can you tell me more?',
          'I understand. Let me review your symptoms.',
          'That\'s helpful context. How long have you been experiencing this?',
          'I see. Let\'s discuss the next steps in your treatment.',
        ];

        const response: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: { id: 'doctor-1', name: 'Dr. Sarah Johnson', role: 'doctor' },
          content: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date(),
          type: 'text',
          encrypted: true,
          encryptionVerified: true,
        };
        setMessages(prev => [...prev, response]);
      }, 2000);
    }
  };

  const handleTypingChange = (isTyping: boolean) => {
    if (isTyping) {
      setTypingUsers(['Dr. Sarah Johnson']);
      setTimeout(() => setTypingUsers([]), 3000);
    }
  };

  const resetDemo = () => {
    setMessages([
      {
        id: '1',
        sender: { id: 'doctor-1', name: 'Dr. Sarah Johnson', role: 'doctor' },
        content: 'Hello! Welcome to our secure video consultation. How are you feeling today?',
        timestamp: new Date(Date.now() - 120000),
        type: 'text',
        encrypted: true,
        encryptionVerified: true,
      },
      {
        id: '2',
        sender: { id: 'system', name: 'System', role: 'moderator' },
        content: 'End-to-end encryption has been established. All messages are now fully encrypted.',
        timestamp: new Date(Date.now() - 90000),
        type: 'system',
        encrypted: true,
        encryptionVerified: true,
      }
    ]);
    setError(null);
    setTypingUsers([]);
  };

  const addSampleMessages = () => {
    const sampleMessages = [
      'I\'ve been having some headaches lately.',
      'The pain is mostly in the morning.',
      'I\'ve been taking the medication as prescribed.',
      'Should I be concerned about the side effects?'
    ];

    sampleMessages.forEach((content, index) => {
      setTimeout(() => {
        handleSendMessage(content, 'text');
      }, index * 1000);
    });
  };

  const simulateError = () => {
    setError({
      message: 'Connection temporarily lost. Attempting to reconnect...',
      code: 'CONNECTION_ERROR'
    });

    setTimeout(() => {
      setError(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/ui"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sandbox
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">VideoChat Component</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addSampleMessages}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Sample Messages
          </button>
          <button
            onClick={simulateError}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Simulate Error
          </button>
          <button
            onClick={resetDemo}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Demo
          </button>
        </div>
      </div>

      {/* Component Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Component Features</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Security Features</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• End-to-end encryption indicators</li>
              <li>• Server-side encryption fallback</li>
              <li>• Encryption verification status</li>
              <li>• Secure message transmission</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">User Experience</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• Real-time typing indicators</li>
              <li>• Emergency alert system</li>
              <li>• Role-based message styling</li>
              <li>• Message timestamp display</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Live Component Demo */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Live Component Demo</h2>
          <p className="text-sm text-gray-600 mt-1">
            Interactive chat with simulated doctor responses and encryption features
          </p>
        </div>

        <div className="p-6 flex justify-center">
          <VideoChat
            sessionId="sandbox-session"
            currentUser={currentUser}
            isVisible={isVisible}
            onClose={() => setIsVisible(false)}
            messages={messages}
            isLoading={isLoading}
            encryptionStatus={encryptionStatus}
            typingUsers={typingUsers}
            unreadCount={0}
            error={error}
            onSendMessage={handleSendMessage}
            onTypingChange={handleTypingChange}
            messagesEndRef={messagesEndRef}
            inputRef={inputRef}
          />
        </div>

        {!isVisible && (
          <div className="p-6 text-center">
            <button
              onClick={() => setIsVisible(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Show Chat
            </button>
          </div>
        )}
      </div>

      {/* Accessibility Notes */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2">Accessibility Features</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• ARIA live regions for message updates</li>
          <li>• Screen reader labels for all controls</li>
          <li>• Keyboard navigation with Enter to send</li>
          <li>• High contrast encryption indicators</li>
          <li>• Descriptive error announcements</li>
          <li>• Focus management for input fields</li>
        </ul>
      </div>
    </div>
  );
}