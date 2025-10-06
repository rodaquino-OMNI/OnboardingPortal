/**
 * Type definitions for video orchestration hooks
 *
 * These types define the contracts between the app layer (orchestration hooks)
 * and the UI layer (presentational components).
 */

export type VideoErrorType =
  | 'SESSION_INIT_FAILED'
  | 'WEBRTC_CONNECTION_FAILED'
  | 'MEDIA_PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'ENCRYPTION_FAILED'
  | 'RECORDING_FAILED';

export interface VideoError {
  type: VideoErrorType;
  message: string;
  recoverable: boolean;
  metadata?: Record<string, any>;
}

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
  turnServers?: any[];
  turnUsername?: string;
  turnCredential?: string;
  settings: {
    recordSession: boolean;
    enableChat: boolean;
    enableScreenShare: boolean;
    hipaaCompliant: boolean;
  };
}

export interface SessionEndData {
  sessionId: string;
  duration: number;
  recordings?: string[];
  metadata?: Record<string, any>;
}

export interface ConnectionStats {
  video?: {
    packetsLost?: number;
    packetsReceived?: number;
    jitter?: number;
  };
  connection?: {
    roundTripTime?: number;
  };
}

export type ConnectionQuality = 'excellent' | 'good' | 'poor';

export type MessageType = 'text' | 'system' | 'emergency';

export interface ChatMessage {
  id: string;
  sender: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  content: string;
  timestamp: Date;
  type: MessageType;
  encrypted: boolean;
  encryptionVerified?: boolean;
}

export type DataChannelState = 'connecting' | 'open' | 'closed';
