/**
 * useVideoConferencingOrchestration Hook
 *
 * Manages WebRTC connections, media streams, session lifecycle, and HIPAA compliance
 * for video conferencing. This hook extracts all orchestration logic from the
 * VideoConferencing component.
 */

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from 'react';
import { HIPAAVideoService } from '@/lib/video-conferencing/HIPAAVideoService';
import { useCancellableRequest } from '@/lib/async-utils';
import api from '@/services/api';
import type {
  VideoSession,
  Participant,
  VideoError,
  ConnectionQuality,
  ConnectionStats,
  SessionEndData,
} from './types';

export interface VideoConferencingOrchestrationConfig {
  interviewId: string;
  participantInfo: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  settings?: {
    autoStartVideo?: boolean;
    autoStartAudio?: boolean;
    enableRecording?: boolean;
    enableChat?: boolean;
  };
  onSessionStart?: (session: VideoSession) => void;
  onSessionEnd?: (sessionData: SessionEndData) => void;
  onError?: (error: VideoError) => void;
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participant: Participant) => void;
}

export interface VideoConferencingOrchestrationReturn {
  // Session State
  session: VideoSession | null;
  isConnected: boolean;
  isConnecting: boolean;
  sessionDuration: number;
  connectionQuality: ConnectionQuality;
  isEncrypted: boolean;
  participants: Participant[];

  // Media State
  localVideo: boolean;
  localAudio: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;

  // Video Refs (for UI components to attach)
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  screenShareRef: RefObject<HTMLVideoElement>;

  // Media Controls
  toggleVideo: () => void;
  toggleAudio: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;

  // Recording Controls
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;

  // Session Controls
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  reconnect: () => Promise<void>;

  // Statistics
  getConnectionStats: () => Promise<ConnectionStats>;

  // Error State
  error: VideoError | null;
  clearError: () => void;
}

export function useVideoConferencingOrchestration(
  config: VideoConferencingOrchestrationConfig
): VideoConferencingOrchestrationReturn {
  const {
    interviewId,
    participantInfo,
    settings = {},
    onSessionStart,
    onSessionEnd,
    onError,
    onParticipantJoined,
    onParticipantLeft,
  } = config;

  // State management
  const [session, setSession] = useState<VideoSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localVideo, setLocalVideo] = useState(settings.autoStartVideo ?? true);
  const [localAudio, setLocalAudio] = useState(settings.autoStartAudio ?? true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('good');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [error, setError] = useState<VideoError | null>(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Refs for video elements and services
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const hipaaVideoServiceRef = useRef<HIPAAVideoService | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { makeRequest, cancelAll } = useCancellableRequest();

  // Analyze connection statistics for quality monitoring
  const analyzeConnectionStats = useCallback((stats: ConnectionStats): ConnectionQuality => {
    const videoStats = stats.video || {};
    const connectionStats = stats.connection || {};

    const packetLoss = videoStats.packetsLost && videoStats.packetsReceived ?
      (videoStats.packetsLost / (videoStats.packetsReceived + videoStats.packetsLost)) * 100 : 0;
    const jitter = videoStats.jitter || 0;
    const roundTripTime = connectionStats.roundTripTime || 0;

    if (packetLoss > 5 || jitter > 100 || roundTripTime > 500) {
      return 'poor';
    } else if (packetLoss > 2 || jitter > 50 || roundTripTime > 200) {
      return 'good';
    }
    return 'excellent';
  }, []);

  // Error handler
  const handleVideoError = useCallback((videoError: VideoError) => {
    if (!mountedRef.current) return;

    setError(videoError);
    onError?.(videoError);

    // Attempt automatic recovery for recoverable errors
    if (videoError.recoverable && videoError.type === 'WEBRTC_CONNECTION_FAILED') {
      setTimeout(() => {
        if (mountedRef.current && session) {
          reconnect();
        }
      }, 2000);
    }
  }, [session, onError]);

  // Setup WebRTC connection with HIPAA compliance
  const setupWebRTC = useCallback(async (sessionData: VideoSession) => {
    try {
      // Initialize HIPAA-compliant video service
      const hipaaService = new HIPAAVideoService({
        stunServers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        turnServers: sessionData.turnServers || [],
        turnUsername: sessionData.turnUsername,
        turnCredential: sessionData.turnCredential,
        sessionId: sessionData.sessionId,
        userId: participantInfo.id,
        role: participantInfo.role,
      });

      hipaaVideoServiceRef.current = hipaaService;

      // Setup event handlers
      hipaaService.on('sessionStarted', () => {
        if (mountedRef.current) {
          setIsEncrypted(true);
        }
      });

      hipaaService.on('remoteStream', (stream: MediaStream) => {
        if (remoteVideoRef.current && mountedRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      });

      hipaaService.on('connectionStateChange', (state: string) => {
        if (!mountedRef.current) return;

        setIsConnected(state === 'connected');
        if (state === 'failed' || state === 'disconnected') {
          handleVideoError({
            type: 'WEBRTC_CONNECTION_FAILED',
            message: 'Connection lost. Attempting to reconnect...',
            recoverable: true,
          });
        }
      });

      hipaaService.on('recordingStarted', () => {
        if (mountedRef.current) {
          setIsRecording(true);
        }
      });

      hipaaService.on('recordingStopped', () => {
        if (mountedRef.current) {
          setIsRecording(false);
        }
      });

      // Start HIPAA-compliant session
      await hipaaService.startSession(sessionData.sessionId);

      // Get local stream for display
      const localStream = hipaaService.getLocalStream();
      if (localStream && localVideoRef.current && mountedRef.current) {
        localStreamRef.current = localStream;
        localVideoRef.current.srcObject = localStream;
      }

      // Monitor connection quality
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }

      statsIntervalRef.current = setInterval(async () => {
        if (hipaaService.getConnectionState() === 'connected' && mountedRef.current) {
          const stats = await hipaaService.getConnectionStats();
          const quality = analyzeConnectionStats(stats);
          setConnectionQuality(quality);
        }
      }, 5000);

    } catch (err) {
      handleVideoError({
        type: 'SESSION_INIT_FAILED',
        message: 'Failed to initialize HIPAA-compliant video session',
        recoverable: false,
        metadata: { error: err },
      });
    }
  }, [participantInfo, analyzeConnectionStats, handleVideoError]);

  // Initialize video session
  const initializeSession = useCallback(async () => {
    if (!mountedRef.current) return;

    const request = makeRequest(
      async (signal: AbortSignal) => {
        if (mountedRef.current) {
          setIsConnecting(true);
          setError(null);
        }

        const response = await api.post('/api/video/sessions', {
          interview_id: interviewId,
          participants: [
            {
              id: participantInfo.id,
              name: participantInfo.name,
              role: participantInfo.role
            }
          ],
          record_session: settings.enableRecording ?? true,
          enable_chat: settings.enableChat ?? true,
          enable_screen_share: true
        });

        if (signal.aborted) {
          throw new Error('Session initialization cancelled');
        }

        if (!response.success) {
          throw new Error(response.message || 'Failed to create session');
        }

        return response.session;
      },
      { timeout: 15000 }
    );

    try {
      const sessionData = await request.promise;

      if (mountedRef.current && !request.isCancelled()) {
        setSession(sessionData);
        onSessionStart?.(sessionData);
        await setupWebRTC(sessionData);
      }
    } catch (err) {
      if (mountedRef.current && !request.isCancelled()) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session';
        if (!errorMessage.includes('cancelled')) {
          handleVideoError({
            type: 'SESSION_INIT_FAILED',
            message: errorMessage,
            recoverable: true,
          });
        }
      }
    } finally {
      if (mountedRef.current && !request.isCancelled()) {
        setIsConnecting(false);
      }
    }
  }, [interviewId, participantInfo, settings, makeRequest, setupWebRTC, onSessionStart, handleVideoError]);

  // Reconnection handler
  const reconnect = useCallback(async () => {
    try {
      setIsConnecting(true);

      await new Promise(resolve => setTimeout(resolve, 2000));

      if (session && mountedRef.current) {
        await setupWebRTC(session);
      }
    } catch (err) {
      handleVideoError({
        type: 'WEBRTC_CONNECTION_FAILED',
        message: 'Failed to reconnect. Please refresh the page.',
        recoverable: false,
      });
    } finally {
      if (mountedRef.current) {
        setIsConnecting(false);
      }
    }
  }, [session, setupWebRTC, handleVideoError]);

  // Toggle local video
  const toggleVideo = useCallback(() => {
    if (hipaaVideoServiceRef.current) {
      const newState = !localVideo;
      hipaaVideoServiceRef.current.toggleLocalVideo(newState);
      setLocalVideo(newState);
    }
  }, [localVideo]);

  // Toggle local audio
  const toggleAudio = useCallback(() => {
    if (hipaaVideoServiceRef.current) {
      const newState = !localAudio;
      hipaaVideoServiceRef.current.toggleLocalAudio(newState);
      setLocalAudio(newState);
    }
  }, [localAudio]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    if (!mountedRef.current) return;

    const request = makeRequest(
      async (signal: AbortSignal) => {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true
        });

        if (signal.aborted) {
          screenStream.getTracks().forEach(track => track.stop());
          throw new Error('Screen sharing cancelled');
        }

        return screenStream;
      },
      { timeout: 10000 }
    );

    try {
      const screenStream = await request.promise;

      if (mountedRef.current && !request.isCancelled()) {
        screenStreamRef.current = screenStream;

        if (screenShareRef.current) {
          screenShareRef.current.srcObject = screenStream;
        }

        if (hipaaVideoServiceRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          await hipaaVideoServiceRef.current.replaceVideoTrack(videoTrack);
        }

        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
          if (mountedRef.current) {
            stopScreenShare();
          }
        });
      }
    } catch (err) {
      if (mountedRef.current && !request.isCancelled()) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start screen sharing';
        if (!errorMessage.includes('cancelled')) {
          setError({
            type: 'MEDIA_PERMISSION_DENIED',
            message: errorMessage,
            recoverable: true,
          });
        }
      }
    }
  }, [makeRequest]);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (hipaaVideoServiceRef.current && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      await hipaaVideoServiceRef.current.replaceVideoTrack(videoTrack);
    }

    setIsScreenSharing(false);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      if (!session || !hipaaVideoServiceRef.current) return;

      await hipaaVideoServiceRef.current.startRecording();

      const response = await api.post(`/api/video/sessions/${session.sessionId}/recording/start`, {
        name: `Consultation_${new Date().toISOString().slice(0, 19)}`,
        include_audio: true,
        include_video: true,
        encrypted: true,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to start recording');
      }
    } catch (err) {
      handleVideoError({
        type: 'RECORDING_FAILED',
        message: 'Failed to start encrypted recording',
        recoverable: true,
        metadata: { error: err },
      });
    }
  }, [session, handleVideoError]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      if (!session || !hipaaVideoServiceRef.current) return;

      await hipaaVideoServiceRef.current.stopRecording();

      const response = await api.post(`/api/video/sessions/${session.sessionId}/recording/stop`);

      if (!response.success) {
        throw new Error(response.message || 'Failed to stop recording');
      }
    } catch (err) {
      handleVideoError({
        type: 'RECORDING_FAILED',
        message: 'Failed to stop recording',
        recoverable: true,
        metadata: { error: err },
      });
    }
  }, [session, handleVideoError]);

  // End session
  const endSession = useCallback(async () => {
    if (!session || !mountedRef.current) return;

    const request = makeRequest(
      async (signal: AbortSignal) => {
        if (isRecording) {
          await stopRecording();
        }

        if (signal.aborted) {
          throw new Error('Session end cancelled');
        }

        const response = await api.post(`/api/video/sessions/${session.sessionId}/end`);
        return response;
      },
      { timeout: 10000 }
    );

    try {
      const response = await request.promise;

      if (mountedRef.current && !request.isCancelled() && response.success) {
        onSessionEnd?.(response.session);
      }
    } catch (err) {
      if (mountedRef.current && !request.isCancelled()) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to end session properly';
        if (!errorMessage.includes('cancelled')) {
          setError({
            type: 'NETWORK_ERROR',
            message: errorMessage,
            recoverable: false,
          });
        }
      }
    } finally {
      if (mountedRef.current) {
        // Cleanup
        if (hipaaVideoServiceRef.current) {
          try {
            hipaaVideoServiceRef.current.destroy();
          } catch (error) {
            console.warn('Error destroying HIPAA service:', error);
          }
          hipaaVideoServiceRef.current = null;
        }

        [localStreamRef.current, screenStreamRef.current].forEach(stream => {
          if (stream) {
            stream.getTracks().forEach(track => {
              try {
                track.stop();
              } catch (error) {
                console.warn('Error stopping track:', error);
              }
            });
          }
        });

        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }

        setIsConnected(false);
        setSession(null);
      }
    }
  }, [session, isRecording, stopRecording, onSessionEnd, makeRequest]);

  // Get connection statistics
  const getConnectionStats = useCallback(async (): Promise<ConnectionStats> => {
    if (hipaaVideoServiceRef.current) {
      return await hipaaVideoServiceRef.current.getConnectionStats();
    }
    return {};
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Session duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isConnected && mountedRef.current) {
      interval = setInterval(() => {
        if (mountedRef.current) {
          setSessionDuration(prev => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isConnected]);

  // Initialize on mount and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    initializeSession();

    return () => {
      mountedRef.current = false;

      cancelAll();

      if (hipaaVideoServiceRef.current) {
        try {
          hipaaVideoServiceRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying video service:', error);
        }
        hipaaVideoServiceRef.current = null;
      }

      [localStreamRef.current, screenStreamRef.current].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (error) {
              console.warn('Error stopping track:', error);
            }
          });
        }
      });

      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }

      localStreamRef.current = null;
      screenStreamRef.current = null;
    };
  }, [initializeSession, cancelAll]);

  return {
    // Session State
    session,
    isConnected,
    isConnecting,
    sessionDuration,
    connectionQuality,
    isEncrypted,
    participants,

    // Media State
    localVideo,
    localAudio,
    isScreenSharing,
    isRecording,

    // Video Refs
    localVideoRef,
    remoteVideoRef,
    screenShareRef,

    // Media Controls
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,

    // Recording Controls
    startRecording,
    stopRecording,

    // Session Controls
    startSession: initializeSession,
    endSession,
    reconnect,

    // Statistics
    getConnectionStats,

    // Error State
    error,
    clearError,
  };
}
