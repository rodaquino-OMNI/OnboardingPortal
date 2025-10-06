import { RefObject } from 'react';
export interface Participant {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
    status: 'joining' | 'joined' | 'left';
    videoEnabled: boolean;
    audioEnabled: boolean;
    isScreenSharing: boolean;
}
export interface VideoSession {
    id: string;
    sessionId: string;
    token: string;
    participants: Participant[];
    settings: {
        recordSession: boolean;
        enableChat: boolean;
        enableScreenShare: boolean;
        hipaaCompliant: boolean;
    };
}
export interface VideoError {
    code: string;
    message: string;
    recoverable: boolean;
}
/**
 * Pure presentational component for video conferencing UI
 * All state management and business logic handled by parent/orchestration layer
 */
interface VideoConferencingProps {
    session: VideoSession | null;
    isConnected: boolean;
    isConnecting: boolean;
    localVideo: boolean;
    localAudio: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    screenStream: MediaStream | null;
    connectionQuality: 'excellent' | 'good' | 'poor';
    sessionDuration: number;
    isRecording: boolean;
    isScreenSharing: boolean;
    isEncrypted: boolean;
    participants: Participant[];
    error: VideoError | null;
    localVideoRef: RefObject<HTMLVideoElement>;
    remoteVideoRef: RefObject<HTMLVideoElement>;
    screenShareRef: RefObject<HTMLVideoElement>;
    onToggleVideo: () => void;
    onToggleAudio: () => void;
    onStartScreenShare: () => Promise<void>;
    onStopScreenShare: () => void;
    onStartRecording: () => Promise<void>;
    onStopRecording: () => Promise<void>;
    onEndSession: () => Promise<void>;
    onError?: (error: VideoError) => void;
    participantInfo: {
        id: string;
        name: string;
        role: 'patient' | 'doctor' | 'moderator';
    };
}
/**
 * Pure presentational video conferencing component
 * All state and business logic managed externally via props and callbacks
 */
export declare function VideoConferencing({ session, isConnected, isConnecting, localVideo, localAudio, localStream, remoteStream, screenStream, connectionQuality, sessionDuration, isRecording, isScreenSharing, isEncrypted, participants, error, localVideoRef, remoteVideoRef, screenShareRef, onToggleVideo, onToggleAudio, onStartScreenShare, onStopScreenShare, onStartRecording, onStopRecording, onEndSession, onError, participantInfo, }: VideoConferencingProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=VideoConferencing.d.ts.map