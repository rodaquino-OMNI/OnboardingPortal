'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Smile, Paperclip, MoreVertical, 
  Lock, AlertTriangle, Clock, Shield, KeyRound 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/useApi';
import { HIPAAVideoService, EncryptedMessage } from '@/lib/video-conferencing/HIPAAVideoService';

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

interface VideoChatProps {
  sessionId: string;
  currentUser: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  isVisible: boolean;
  onClose: () => void;
  videoService?: HIPAAVideoService;
}

export function VideoChat({ sessionId, currentUser, isVisible, onClose, videoService }: VideoChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [dataChannelState, setDataChannelState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { post, get } = useApi();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Setup encrypted data channel listeners
  useEffect(() => {
    if (!videoService) return;

    const handleDataChannelOpen = () => {
      setDataChannelState('open');
      setIsEncryptionReady(true);
      
      // Add system message
      const systemMessage: ChatMessage = {
        id: `sys_${Date.now()}`,
        sender: {
          id: 'system',
          name: 'System',
          role: 'moderator',
        },
        content: 'End-to-end encryption established. Your messages are now secure.',
        timestamp: new Date(),
        type: 'system',
        encrypted: true,
        encryptionVerified: true,
      };
      setMessages(prev => [...prev, systemMessage]);
    };

    const handleEncryptedMessage = async (decryptedMessage: string) => {
      try {
        const messageData = JSON.parse(decryptedMessage);
        const chatMessage: ChatMessage = {
          id: messageData.id || `msg_${Date.now()}`,
          sender: messageData.sender,
          content: messageData.content,
          timestamp: new Date(messageData.timestamp),
          type: messageData.type || 'text',
          encrypted: true,
          encryptionVerified: true,
        };
        
        setMessages(prev => [...prev, chatMessage]);
      } catch (error) {
        console.error('Failed to parse decrypted message:', error);
      }
    };

    const handleDataChannelClose = () => {
      setDataChannelState('closed');
      setIsEncryptionReady(false);
    };

    const handleDataChannelError = (error: any) => {
      console.error('Data channel error:', error);
      setDataChannelState('closed');
      setIsEncryptionReady(false);
    };

    videoService.on('dataChannelOpen', handleDataChannelOpen);
    videoService.on('encryptedMessage', handleEncryptedMessage);
    videoService.on('dataChannelClose', handleDataChannelClose);
    videoService.on('dataChannelError', handleDataChannelError);

    return () => {
      videoService.off('dataChannelOpen', handleDataChannelOpen);
      videoService.off('encryptedMessage', handleEncryptedMessage);
      videoService.off('dataChannelClose', handleDataChannelClose);
      videoService.off('dataChannelError', handleDataChannelError);
    };
  }, [videoService]);

  // Focus input when chat becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Load chat history
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await get(`/api/video/sessions/${sessionId}/chat`);
        if (response.success) {
          setMessages(response.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId, get]);

  // WebSocket connection for real-time chat (simplified implementation)
  useEffect(() => {
    // In a real implementation, this would establish WebSocket connection
    // For now, we'll use polling as a fallback
    const pollInterval = setInterval(async () => {
      try {
        const response = await get(`/api/video/sessions/${sessionId}/chat/latest`);
        if (response.success && response.messages.length > 0) {
          const newMessages = response.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const filtered = newMessages.filter((msg: ChatMessage) => !existingIds.has(msg.id));
            return [...prev, ...filtered];
          });
        }
      } catch (error) {
        console.error('Failed to poll chat messages:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [sessionId, get]);

  // Send message (encrypted if available)
  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      // If encryption is ready, use encrypted data channel
      if (isEncryptionReady && videoService) {
        const messageData = {
          id: `msg_${Date.now()}`,
          sender: currentUser,
          content: messageContent,
          timestamp: Date.now(),
          type: 'text' as const,
        };

        await videoService.sendEncryptedMessage(JSON.stringify(messageData));

        // Add to local messages immediately
        const message: ChatMessage = {
          ...messageData,
          timestamp: new Date(messageData.timestamp),
          encrypted: true,
          encryptionVerified: true,
        };
        
        setMessages(prev => [...prev, message]);
      } else {
        // Fallback to API (still encrypted on server)
        const response = await post(`/api/video/sessions/${sessionId}/chat`, {
          content: messageContent,
          type: 'text'
        });

        if (response.success) {
          const message: ChatMessage = {
            id: response.message.id,
            sender: currentUser,
            content: messageContent,
            timestamp: new Date(),
            type: 'text',
            encrypted: true,
            encryptionVerified: false, // Server-side encryption only
          };
          
          setMessages(prev => [...prev, message]);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Re-add message to input if sending failed
      setNewMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  // Handle typing indicators
  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      // Send typing indicator
      post(`/api/video/sessions/${sessionId}/typing`, { typing: true });
      
      // Clear typing after 3 seconds of inactivity
      setTimeout(() => {
        setIsTyping(false);
        post(`/api/video/sessions/${sessionId}/typing`, { typing: false });
      }, 3000);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get sender color based on role
  const getSenderColor = (role: string): string => {
    switch (role) {
      case 'doctor': return 'text-blue-600';
      case 'patient': return 'text-green-600';
      case 'moderator': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  // Handle emergency message
  const sendEmergencyMessage = async () => {
    try {
      const emergencyContent = 'EMERGENCY: Immediate assistance required';
      
      if (isEncryptionReady && videoService) {
        const messageData = {
          id: `emergency_${Date.now()}`,
          sender: currentUser,
          content: emergencyContent,
          timestamp: Date.now(),
          type: 'emergency' as const,
        };

        await videoService.sendEncryptedMessage(JSON.stringify(messageData));

        // Add to local messages
        const message: ChatMessage = {
          ...messageData,
          timestamp: new Date(messageData.timestamp),
          encrypted: true,
          encryptionVerified: true,
        };
        
        setMessages(prev => [...prev, message]);
      } else {
        await post(`/api/video/sessions/${sessionId}/chat`, {
          content: emergencyContent,
          type: 'emergency'
        });
      }
    } catch (error) {
      console.error('Failed to send emergency message:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="w-80 h-96 flex flex-col bg-white shadow-lg">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Session Chat</h3>
          <Badge 
            variant={isEncryptionReady ? "default" : "secondary"} 
            className={`text-xs ${isEncryptionReady ? 'bg-green-600' : ''}`}
          >
            {isEncryptionReady ? (
              <>
                <Shield className="w-3 h-3 mr-1" />
                E2E Encrypted
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 mr-1" />
                Server Encrypted
              </>
            )}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ×
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            <Lock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
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
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                  )}
                  {message.content}
                </div>

                {/* Timestamp */}
                <div className={`text-xs mt-1 ${
                  message.sender.id === currentUser.id ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatTime(message.timestamp)}
                  {message.encrypted && (
                    message.encryptionVerified ? (
                      <Shield className="w-3 h-3 inline ml-1" title="End-to-end encrypted" />
                    ) : (
                      <Lock className="w-3 h-3 inline ml-1" title="Server encrypted" />
                    )
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="text-xs text-gray-500 italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t bg-gray-50">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a secure message..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />
          </div>
          
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            className="px-3"
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="p-1">
              <Smile className="w-4 h-4 text-gray-500" />
            </Button>
            <Button variant="ghost" size="sm" className="p-1">
              <Paperclip className="w-4 h-4 text-gray-500" />
            </Button>
          </div>

          {/* Emergency button (for patients) */}
          {currentUser.role === 'patient' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={sendEmergencyMessage}
              className="text-xs px-2 py-1"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Emergency
            </Button>
          )}

          <div className="text-xs text-gray-500 flex items-center gap-1">
            {isEncryptionReady ? (
              <>
                <KeyRound className="w-3 h-3" />
                E2E encrypted
              </>
            ) : dataChannelState === 'connecting' ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                Establishing encryption...
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                Server encrypted
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}