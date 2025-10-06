import { RefObject } from 'react';
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
    onSendMessage: (content: string, type: 'text' | 'emergency') => Promise<void>;
    onTypingChange: (isTyping: boolean) => void;
    messagesEndRef: RefObject<HTMLDivElement>;
    inputRef: RefObject<HTMLInputElement>;
}
export declare function VideoChat({ currentUser, isVisible, onClose, messages, isLoading, encryptionStatus, typingUsers, error, onSendMessage, onTypingChange, messagesEndRef, inputRef, }: VideoChatProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=VideoChat.d.ts.map