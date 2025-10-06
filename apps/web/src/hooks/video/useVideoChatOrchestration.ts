/**
 * useVideoChatOrchestration Hook
 *
 * Manages encrypted chat messaging, typing indicators, message persistence,
 * and data channel communication for video conferencing chat.
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { HIPAAVideoService } from '@/lib/video-conferencing/HIPAAVideoService';
import { useApi } from '@/hooks/useApi';
import type { ChatMessage, MessageType, DataChannelState } from './types';

export interface VideoChatOrchestrationConfig {
  sessionId: string;
  currentUser: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  videoService?: HIPAAVideoService;
  settings?: {
    enableTypingIndicators?: boolean;
    enableMessagePersistence?: boolean;
    maxMessageLength?: number;
  };
  onMessageReceived?: (message: ChatMessage) => void;
  onEncryptionStatusChange?: (encrypted: boolean) => void;
}

export interface VideoChatOrchestrationReturn {
  // Messages State
  messages: ChatMessage[];
  unreadCount: number;
  isEncryptionReady: boolean;
  dataChannelState: DataChannelState;

  // Typing State
  isTyping: boolean;
  typingUsers: string[];

  // Message Actions
  sendMessage: (content: string, type?: MessageType) => Promise<void>;
  sendEmergencyMessage: () => Promise<void>;
  markAsRead: (messageId: string) => void;
  deleteMessage: (messageId: string) => Promise<void>;

  // UI State
  newMessage: string;
  setNewMessage: (value: string) => void;
  isSending: boolean;

  // Refs
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;

  // Utilities
  loadChatHistory: () => Promise<void>;
  clearMessages: () => void;
}

export function useVideoChatOrchestration(
  config: VideoChatOrchestrationConfig
): VideoChatOrchestrationReturn {
  const {
    sessionId,
    currentUser,
    videoService,
    settings = {},
    onMessageReceived,
    onEncryptionStatusChange,
  } = config;

  const {
    enableTypingIndicators = true,
    maxMessageLength = 500,
  } = settings;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [dataChannelState, setDataChannelState] = useState<DataChannelState>('connecting');
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { post, get } = useApi();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Setup encrypted data channel listeners
  useEffect(() => {
    if (!videoService) return;

    const handleDataChannelOpen = () => {
      if (!mountedRef.current) return;

      setDataChannelState('open');
      setIsEncryptionReady(true);
      onEncryptionStatusChange?.(true);

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
      if (!mountedRef.current) return;

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
        onMessageReceived?.(chatMessage);

        // Increment unread count if not from current user
        if (chatMessage.sender.id !== currentUser.id) {
          setUnreadCount(prev => prev + 1);
        }
      } catch (error) {
        console.error('Failed to parse decrypted message:', error);
      }
    };

    const handleDataChannelClose = () => {
      if (!mountedRef.current) return;

      setDataChannelState('closed');
      setIsEncryptionReady(false);
      onEncryptionStatusChange?.(false);
    };

    const handleDataChannelError = (error: any) => {
      console.error('Data channel error:', error);
      if (mountedRef.current) {
        setDataChannelState('closed');
        setIsEncryptionReady(false);
        onEncryptionStatusChange?.(false);
      }
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
  }, [videoService, currentUser.id, onMessageReceived, onEncryptionStatusChange]);

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await get(`/api/video/sessions/${sessionId}/chat`);
      if (response.success && mountedRef.current) {
        setMessages(response.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [sessionId, get]);

  // Load chat history on mount
  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId, loadChatHistory]);

  // Polling for new messages (fallback when data channel not available)
  useEffect(() => {
    if (isEncryptionReady) {
      // Stop polling if encryption is ready (using data channel)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // Poll for new messages every 2 seconds as fallback
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await get(`/api/video/sessions/${sessionId}/chat/latest`);
        if (response.success && response.messages.length > 0 && mountedRef.current) {
          const newMessages = response.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));

          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const filtered = newMessages.filter((msg: ChatMessage) => !existingIds.has(msg.id));

            // Update unread count
            const unreadFromOthers = filtered.filter(m => m.sender.id !== currentUser.id).length;
            if (unreadFromOthers > 0) {
              setUnreadCount(prevCount => prevCount + unreadFromOthers);
            }

            return [...prev, ...filtered];
          });
        }
      } catch (error) {
        console.error('Failed to poll chat messages:', error);
      }
    }, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [sessionId, isEncryptionReady, currentUser.id, get]);

  // Send message
  const sendMessage = useCallback(async (content: string, type: MessageType = 'text') => {
    if (!content.trim() || isSending) return;

    // Check message length
    if (content.length > maxMessageLength) {
      console.error(`Message exceeds maximum length of ${maxMessageLength} characters`);
      return;
    }

    setIsSending(true);
    const messageContent = content.trim();

    try {
      // Use encrypted data channel if available
      if (isEncryptionReady && videoService) {
        const messageData = {
          id: `msg_${Date.now()}`,
          sender: currentUser,
          content: messageContent,
          timestamp: Date.now(),
          type,
        };

        await videoService.sendEncryptedMessage(JSON.stringify(messageData));

        // Add to local messages immediately
        const message: ChatMessage = {
          ...messageData,
          timestamp: new Date(messageData.timestamp),
          encrypted: true,
          encryptionVerified: true,
        };

        if (mountedRef.current) {
          setMessages(prev => [...prev, message]);
        }
      } else {
        // Fallback to API (server-side encryption)
        const response = await post(`/api/video/sessions/${sessionId}/chat`, {
          content: messageContent,
          type
        });

        if (response.success && mountedRef.current) {
          const message: ChatMessage = {
            id: response.message.id,
            sender: currentUser,
            content: messageContent,
            timestamp: new Date(),
            type,
            encrypted: true,
            encryptionVerified: false, // Server-side encryption only
          };

          setMessages(prev => [...prev, message]);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      if (mountedRef.current) {
        setIsSending(false);
      }
    }
  }, [isSending, maxMessageLength, isEncryptionReady, videoService, currentUser, sessionId, post]);

  // Send emergency message
  const sendEmergencyMessage = useCallback(async () => {
    await sendMessage('EMERGENCY: Immediate assistance required', 'emergency');
  }, [sendMessage]);

  // Mark message as read
  const markAsRead = useCallback((messageId: string) => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await post(`/api/video/sessions/${sessionId}/chat/${messageId}/delete`, {});

      if (mountedRef.current) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, [sessionId, post]);

  // Handle typing with debounce
  const handleSetNewMessage = useCallback((value: string) => {
    setNewMessage(value);

    if (!enableTypingIndicators) return;

    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      post(`/api/video/sessions/${sessionId}/typing`, { typing: true });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      post(`/api/video/sessions/${sessionId}/typing`, { typing: false });
    }, 3000);
  }, [isTyping, enableTypingIndicators, sessionId, post]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setUnreadCount(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    // Messages State
    messages,
    unreadCount,
    isEncryptionReady,
    dataChannelState,

    // Typing State
    isTyping,
    typingUsers,

    // Message Actions
    sendMessage,
    sendEmergencyMessage,
    markAsRead,
    deleteMessage,

    // UI State
    newMessage,
    setNewMessage: handleSetNewMessage,
    isSending,

    // Refs
    messagesEndRef,
    inputRef,

    // Utilities
    loadChatHistory,
    clearMessages,
  };
}
