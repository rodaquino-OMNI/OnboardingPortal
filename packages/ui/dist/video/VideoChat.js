'use client';
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Send, Smile, Paperclip, Lock, AlertTriangle, Clock, Shield, KeyRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export function VideoChat({ currentUser, isVisible, onClose, messages, isLoading, encryptionStatus, typingUsers, error, onSendMessage, onTypingChange, messagesEndRef, inputRef, }) {
    // Local UI state only
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    // Handle message sending
    const handleSendMessage = async () => {
        if (!newMessage.trim() || isSending)
            return;
        setIsSending(true);
        const messageContent = newMessage.trim();
        setNewMessage('');
        try {
            await onSendMessage(messageContent, 'text');
        }
        catch (error) {
            console.error('Failed to send message:', error);
            // Restore message on failure
            setNewMessage(messageContent);
        }
        finally {
            setIsSending(false);
        }
    };
    // Handle typing indicator
    const handleTyping = (value) => {
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
        }
        catch (error) {
            console.error('Failed to send emergency message:', error);
        }
    };
    // Format timestamp
    const formatTime = (timestamp) => {
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    // Get sender color based on role
    const getSenderColor = (role) => {
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
    if (!isVisible)
        return null;
    return (_jsxs(Card, { className: "w-80 h-96 flex flex-col bg-white shadow-lg", role: "region", "aria-label": "Video chat session", children: [_jsxs("div", { className: "p-3 border-b flex items-center justify-between bg-gray-50", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-semibold text-sm", children: "Session Chat" }), _jsx(Badge, { variant: encryptionStatus.ready ? 'default' : 'secondary', className: `text-xs ${encryptionStatus.ready ? 'bg-green-600' : ''}`, "aria-label": encryptionStatus.ready ? 'End-to-end encrypted' : 'Server encrypted', children: encryptionStatus.ready ? (_jsxs(_Fragment, { children: [_jsx(Shield, { className: "w-3 h-3 mr-1", "aria-hidden": "true" }), "E2E Encrypted"] })) : (_jsxs(_Fragment, { children: [_jsx(Lock, { className: "w-3 h-3 mr-1", "aria-hidden": "true" }), "Server Encrypted"] })) })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onClose, "aria-label": "Close chat", children: "\u00D7" })] }), error && (_jsxs("div", { className: "p-3 bg-red-50 border-b border-red-200 text-red-800 text-sm", role: "alert", children: [_jsx(AlertTriangle, { className: "w-4 h-4 inline mr-2", "aria-hidden": "true" }), error.message] })), _jsxs("div", { className: "flex-1 overflow-y-auto p-3 space-y-3", role: "log", "aria-label": "Chat messages", "aria-live": "polite", "aria-atomic": "false", children: [isLoading ? (_jsxs("div", { className: "text-center text-gray-500 text-sm py-8", "aria-live": "polite", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mx-auto mb-2", "aria-hidden": "true" }), _jsx("p", { children: "Loading chat..." })] })) : messages.length === 0 ? (_jsxs("div", { className: "text-center text-gray-500 text-sm py-8", children: [_jsx(Lock, { className: "w-8 h-8 mx-auto mb-2 text-gray-300", "aria-hidden": "true" }), _jsx("p", { children: "Secure chat is ready" }), _jsx("p", { className: "text-xs", children: "Messages are end-to-end encrypted" })] })) : (messages.map((message) => (_jsx("div", { className: `flex ${message.sender.id === currentUser.id ? 'justify-end' : 'justify-start'}`, role: "article", "aria-label": `Message from ${message.sender.name}`, children: _jsxs("div", { className: `max-w-[80%] rounded-lg px-3 py-2 ${message.sender.id === currentUser.id
                                ? 'bg-blue-500 text-white'
                                : message.type === 'emergency'
                                    ? 'bg-red-100 border border-red-300 text-red-800'
                                    : message.type === 'system'
                                        ? 'bg-gray-100 text-gray-700 text-center'
                                        : 'bg-gray-100 text-gray-800'}`, children: [message.sender.id !== currentUser.id && message.type !== 'system' && (_jsxs("div", { className: "flex items-center gap-1 mb-1", children: [_jsx("span", { className: `text-xs font-semibold ${getSenderColor(message.sender.role)}`, children: message.sender.name }), _jsx(Badge, { variant: "outline", className: "text-xs py-0 px-1", children: message.sender.role })] })), _jsxs("div", { className: "text-sm", children: [message.type === 'emergency' && (_jsx(AlertTriangle, { className: "w-4 h-4 inline mr-1", "aria-label": "Emergency" })), message.content] }), _jsxs("div", { className: `text-xs mt-1 ${message.sender.id === currentUser.id ? 'text-blue-100' : 'text-gray-500'}`, children: [_jsx(Clock, { className: "w-3 h-3 inline mr-1", "aria-hidden": "true" }), _jsx("time", { dateTime: message.timestamp.toISOString(), children: formatTime(message.timestamp) }), message.encrypted && (message.encryptionVerified ? (_jsx(Shield, { className: "w-3 h-3 inline ml-1", "aria-label": "End-to-end encrypted" })) : (_jsx(Lock, { className: "w-3 h-3 inline ml-1", "aria-label": "Server encrypted" })))] })] }) }, message.id)))), typingUsers.length > 0 && (_jsxs("div", { className: "text-xs text-gray-500 italic", "aria-live": "polite", children: [typingUsers.join(', '), " ", typingUsers.length === 1 ? 'is' : 'are', " typing..."] })), _jsx("div", { ref: messagesEndRef, "aria-hidden": "true" })] }), _jsxs("div", { className: "p-3 border-t bg-gray-50", children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx("label", { htmlFor: "chat-message-input", className: "sr-only", children: "Type a secure message" }), _jsx("input", { id: "chat-message-input", ref: inputRef, type: "text", value: newMessage, onChange: (e) => handleTyping(e.target.value), onKeyDown: (e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }, placeholder: "Type a secure message...", className: "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", disabled: isSending, "aria-describedby": "encryption-status" })] }), _jsx(Button, { size: "sm", onClick: handleSendMessage, disabled: !newMessage.trim() || isSending, className: "px-3", "aria-label": "Send message", children: isSending ? (_jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white", "aria-hidden": "true" })) : (_jsx(Send, { className: "w-4 h-4", "aria-hidden": "true" })) })] }), _jsxs("div", { className: "flex items-center justify-between mt-2", children: [_jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { variant: "ghost", size: "sm", className: "p-1", "aria-label": "Add emoji", children: _jsx(Smile, { className: "w-4 h-4 text-gray-500", "aria-hidden": "true" }) }), _jsx(Button, { variant: "ghost", size: "sm", className: "p-1", "aria-label": "Attach file", children: _jsx(Paperclip, { className: "w-4 h-4 text-gray-500", "aria-hidden": "true" }) })] }), currentUser.role === 'patient' && (_jsxs(Button, { variant: "destructive", size: "sm", onClick: handleEmergencyMessage, className: "text-xs px-2 py-1", "aria-label": "Send emergency alert", children: [_jsx(AlertTriangle, { className: "w-3 h-3 mr-1", "aria-hidden": "true" }), "Emergency"] })), _jsx("div", { id: "encryption-status", className: "text-xs text-gray-500 flex items-center gap-1", "aria-live": "polite", children: encryptionStatus.ready ? (_jsxs(_Fragment, { children: [_jsx(KeyRound, { className: "w-3 h-3", "aria-hidden": "true" }), "E2E encrypted"] })) : encryptionStatus.channelState === 'connecting' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500", "aria-hidden": "true" }), "Establishing encryption..."] })) : (_jsxs(_Fragment, { children: [_jsx(Lock, { className: "w-3 h-3", "aria-hidden": "true" }), "Server encrypted"] })) })] })] })] }));
}
