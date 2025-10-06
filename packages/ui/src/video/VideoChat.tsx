'use client';

import { useState, RefObject } from 'react';
import {
  Send, Smile, Paperclip,
  Lock, AlertTriangle, Clock, Shield, KeyRound
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

interface VideoError {
  message: string;
  code?: string;
}

interface VideoChatProps {
  sessionId: string;
  currentUser: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  isVisible: boolean;
  onClose: () => void;

  // Orchestrated data
  messages: ChatMessage[];
  isLoading: boolean;
  encryptionStatus: {
    ready: boolean;
    verified: boolean;
    channelState: 'connecting' | 'open' | 'closed';
  };
  typingUsers: string[];
  unreadCount: number;
  error: VideoError | null;

  // Callbacks
  onSendMessage: (content: string, type: 'text' | 'emergency') => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;

  // Refs
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
}

export function VideoChat({
  currentUser,
  isVisible,
  onClose,
  messages,
  isLoading,
  encryptionStatus,
  typingUsers,
  error,
  onSendMessage,
  onTypingChange,
  messagesEndRef,
  inputRef,
}: VideoChatProps) {
  // Local UI state only
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Handle message sending
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      await onSendMessage(messageContent, 'text');
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message on failure
      setNewMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  // Handle typing indicator
  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      onTypingChange(true);

      // Clear typing after 3 seconds of inactivity
      setTimeout(() => {
        setIsTyping(false);
        onTypingChange(false);
      }, 3000);
    }
  };

  // Handle emergency message
  const handleEmergencyMessage = async () => {
    try {
      await onSendMessage('EMERGENCY: Immediate assistance required', 'emergency');
    } catch (error) {
      console.error('Failed to send emergency message:', error);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get sender color based on role
  const getSenderColor = (role: string): string => {
    switch (role) {
      case 'doctor':
        return 'text-blue-600';
      case 'patient':
        return 'text-green-600';
      case 'moderator':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="w-80 h-96 flex flex-col bg-white shadow-lg" role="region" aria-label="Video chat session">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Session Chat</h3>
          <Badge
            variant={encryptionStatus.ready ? 'default' : 'secondary'}
            className={`text-xs ${encryptionStatus.ready ? 'bg-green-600' : ''}`}
            aria-label={encryptionStatus.ready ? 'End-to-end encrypted' : 'Server encrypted'}
          >
            {encryptionStatus.ready ? (
              <>
                <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                E2E Encrypted
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
                Server Encrypted
              </>
            )}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close chat">
          ×
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-red-800 text-sm" role="alert">
          <AlertTriangle className="w-4 h-4 inline mr-2" aria-hidden="true" />
          {error.message}
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        {isLoading ? (
          <div className="text-center text-gray-500 text-sm py-8" aria-live="polite">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mx-auto mb-2" aria-hidden="true"></div>
            <p>Loading chat...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            <Lock className="w-8 h-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
            <p>Secure chat is ready</p>
            <p className="text-xs">Messages are end-to-end encrypted</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender.id === currentUser.id ? 'justify-end' : 'justify-start'
              }`}
              role="article"
              aria-label={`Message from ${message.sender.name}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  message.sender.id === currentUser.id
                    ? 'bg-blue-500 text-white'
                    : message.type === 'emergency'
                    ? 'bg-red-100 border border-red-300 text-red-800'
                    : message.type === 'system'
                    ? 'bg-gray-100 text-gray-700 text-center'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {/* Sender info for received messages */}
                {message.sender.id !== currentUser.id && message.type !== 'system' && (
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`text-xs font-semibold ${getSenderColor(message.sender.role)}`}>
                      {message.sender.name}
                    </span>
                    <Badge variant="outline" className="text-xs py-0 px-1">
                      {message.sender.role}
                    </Badge>
                  </div>
                )}

                {/* Message content */}
                <div className="text-sm">
                  {message.type === 'emergency' && (
                    <AlertTriangle className="w-4 h-4 inline mr-1" aria-label="Emergency" />
                  )}
                  {message.content}
                </div>

                {/* Timestamp */}
                <div
                  className={`text-xs mt-1 ${
                    message.sender.id === currentUser.id ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  <Clock className="w-3 h-3 inline mr-1" aria-hidden="true" />
                  <time dateTime={message.timestamp.toISOString()}>{formatTime(message.timestamp)}</time>
                  {message.encrypted && (
                    message.encryptionVerified ? (
                      <Shield className="w-3 h-3 inline ml-1" aria-label="End-to-end encrypted" />
                    ) : (
                      <Lock className="w-3 h-3 inline ml-1" aria-label="Server encrypted" />
                    )
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="text-xs text-gray-500 italic" aria-live="polite">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Input area */}
      <div className="p-3 border-t bg-gray-50">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <label htmlFor="chat-message-input" className="sr-only">
              Type a secure message
            </label>
            <input
              id="chat-message-input"
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a secure message..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
              aria-describedby="encryption-status"
            />
          </div>

          <Button
            size="sm"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            className="px-3"
            aria-label="Send message"
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" aria-hidden="true"></div>
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="p-1" aria-label="Add emoji">
              <Smile className="w-4 h-4 text-gray-500" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" className="p-1" aria-label="Attach file">
              <Paperclip className="w-4 h-4 text-gray-500" aria-hidden="true" />
            </Button>
          </div>

          {/* Emergency button (for patients) */}
          {currentUser.role === 'patient' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEmergencyMessage}
              className="text-xs px-2 py-1"
              aria-label="Send emergency alert"
            >
              <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
              Emergency
            </Button>
          )}

          <div id="encryption-status" className="text-xs text-gray-500 flex items-center gap-1" aria-live="polite">
            {encryptionStatus.ready ? (
              <>
                <KeyRound className="w-3 h-3" aria-hidden="true" />
                E2E encrypted
              </>
            ) : encryptionStatus.channelState === 'connecting' ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500" aria-hidden="true"></div>
                Establishing encryption...
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" aria-hidden="true" />
                Server encrypted
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}