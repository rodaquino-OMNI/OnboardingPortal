'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff, 
  Monitor, MonitorOff, MessageCircle, Settings, 
  Users, Circle, Square, Download, Camera,
  AlertTriangle, Shield, Clock, Wifi, Lock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApi } from '@/hooks/useApi';
import { HIPAAVideoService } from '@/lib/video-conferencing/HIPAAVideoService';
import { VideoChat } from './VideoChat';

// Type definitions for video conferencing
interface Participant {
  id: string;
  name: string;
  role: 'patient' | 'doctor' | 'moderator';
  status: 'joining' | 'joined' | 'left';
  videoEnabled: boolean;
  audioEnabled: boolean;
  isScreenSharing: boolean;
}

interface VideoSession {
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

interface VideoConferencingProps {
  interviewId: string;
  participantInfo: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  onSessionEnd?: (sessionData: any) => void;
  onError?: (error: string) => void;
}

export function VideoConferencing({ 
  interviewId, 
  participantInfo, 
  onSessionEnd, 
  onError 
}: VideoConferencingProps) {
  // State management
  const [session, setSession] = useState<VideoSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localVideo, setLocalVideo] = useState(true);
  const [localAudio, setLocalAudio] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('good');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isEncrypted, setIsEncrypted] = useState(false);

  // Refs for video elements and WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const hipaaVideoServiceRef = useRef<HIPAAVideoService | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // API hook
  const { post, get } = useApi();

  // Initialize video session
  const initializeSession = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Create or join video session
      const response = await post('/api/video/sessions', {
        interview_id: interviewId,
        participants: [
          {
            id: participantInfo.id,
            name: participantInfo.name,
            role: participantInfo.role
          }
        ],
        record_session: true,
        enable_chat: true,
        enable_screen_share: true
      });

      if (response.success) {
        setSession(response.session);
        await setupWebRTC(response.session);
      } else {
        throw new Error(response.message || 'Failed to create session');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [interviewId, participantInfo, post, onError]);

  // Setup WebRTC connection with HIPAA compliance
  const setupWebRTC = async (sessionData: VideoSession) => {
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
      hipaaService.on('sessionStarted', (session) => {
        setIsEncrypted(true);
        console.log('HIPAA-compliant session started with E2E encryption');
      });

      hipaaService.on('remoteStream', (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      });

      hipaaService.on('connectionStateChange', (state) => {
        setIsConnected(state === 'connected');
        if (state === 'failed' || state === 'disconnected') {
          setError('Connection lost. Attempting to reconnect...');
        }
      });

      hipaaService.on('recordingStarted', () => {
        setIsRecording(true);
      });

      hipaaService.on('recordingStopped', () => {
        setIsRecording(false);
      });

      // Start HIPAA-compliant session
      await hipaaService.startSession(sessionData.sessionId);

      // Get local stream for display
      const localStream = hipaaService.getLocalStream();
      if (localStream && localVideoRef.current) {
        localStreamRef.current = localStream;
        localVideoRef.current.srcObject = localStream;
      }

      // Monitor connection quality
      const statsInterval = setInterval(async () => {
        if (hipaaService.getConnectionState() === 'connected') {
          const stats = await hipaaService.getConnectionStats();
          const quality = analyzeConnectionStats(stats);
          setConnectionQuality(quality);
        }
      }, 5000);

      // Clean up interval on component unmount
      return () => clearInterval(statsInterval);

    } catch (err) {
      setError('Failed to initialize HIPAA-compliant video session');
      onError?.('HIPAA video initialization failed');
    }
  };

  // Analyze connection statistics for quality monitoring
  const analyzeConnectionStats = (stats: any): 'excellent' | 'good' | 'poor' => {
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
  };

  // Handle reconnection attempts
  const handleReconnection = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Attempt to reconnect
      if (session) {
        await setupWebRTC(session);
      }
    } catch (err) {
      setError('Failed to reconnect. Please refresh the page.');
    } finally {
      setIsConnecting(false);
    }
  }, [session]);

  // Toggle local video
  const toggleVideo = useCallback(() => {
    if (hipaaVideoServiceRef.current) {
      hipaaVideoServiceRef.current.toggleLocalVideo(!localVideo);
      setLocalVideo(!localVideo);
    }
  }, [localVideo]);

  // Toggle local audio
  const toggleAudio = useCallback(() => {
    if (hipaaVideoServiceRef.current) {
      hipaaVideoServiceRef.current.toggleLocalAudio(!localAudio);
      setLocalAudio(!localAudio);
    }
  }, [localAudio]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });

      screenStreamRef.current = screenStream;
      
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = screenStream;
      }

      // Replace video track in HIPAA service
      if (hipaaVideoServiceRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];
        await hipaaVideoServiceRef.current.replaceVideoTrack(videoTrack);
      }

      setIsScreenSharing(true);

      // Handle screen share end
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });

    } catch (err) {
      setError('Failed to start screen sharing');
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Switch back to camera
    if (hipaaVideoServiceRef.current && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      await hipaaVideoServiceRef.current.replaceVideoTrack(videoTrack);
    }

    setIsScreenSharing(false);
  }, []);

  // Start recording with encryption
  const startRecording = useCallback(async () => {
    try {
      if (!session || !hipaaVideoServiceRef.current) return;

      // Start encrypted recording through HIPAA service
      await hipaaVideoServiceRef.current.startRecording();

      // Notify server
      const response = await post(`/api/video/sessions/${session.sessionId}/recording/start`, {
        name: `Consultation_${new Date().toISOString().slice(0, 19)}`,
        include_audio: true,
        include_video: true,
        encrypted: true,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to start recording');
      }
    } catch (err) {
      setError('Failed to start encrypted recording');
    }
  }, [session, post]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      if (!session || !hipaaVideoServiceRef.current) return;

      // Stop encrypted recording through HIPAA service
      await hipaaVideoServiceRef.current.stopRecording();

      // Notify server
      const response = await post(`/api/video/sessions/${session.sessionId}/recording/stop`);

      if (!response.success) {
        throw new Error(response.message || 'Failed to stop recording');
      }
    } catch (err) {
      setError('Failed to stop recording');
    }
  }, [session, post]);

  // End session
  const endSession = useCallback(async () => {
    try {
      if (!session) return;

      // Stop recording if active
      if (isRecording) {
        await stopRecording();
      }

      // Clean up HIPAA video service
      if (hipaaVideoServiceRef.current) {
        hipaaVideoServiceRef.current.destroy();
      }

      // Stop all media streams
      [localStreamRef.current, screenStreamRef.current].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });

      // End session on server
      const response = await post(`/api/video/sessions/${session.sessionId}/end`);

      if (response.success) {
        onSessionEnd?.(response.session);
      }

      setIsConnected(false);
      setSession(null);

    } catch (err) {
      setError('Failed to end session properly');
    }
  }, [session, isRecording, stopRecording, post, onSessionEnd]);

  // Session duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isConnected) {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isConnected]);

  // Initialize session on component mount
  useEffect(() => {
    initializeSession();

    // Cleanup on unmount
    return () => {
      if (hipaaVideoServiceRef.current) {
        hipaaVideoServiceRef.current.destroy();
      }
      [localStreamRef.current, screenStreamRef.current].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });
    };
  }, [initializeSession]);

  // Format session duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Get connection quality color
  const getQualityColor = (quality: string): string => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 relative">
      {/* Header with session info */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-black/50 text-white">
              <Shield className="w-4 h-4 mr-1" />
              HIPAA Compliant
            </Badge>
            {isEncrypted && (
              <Badge variant="secondary" className="bg-green-600/90 text-white">
                <Lock className="w-4 h-4 mr-1" />
                E2E Encrypted
              </Badge>
            )}
            <Badge variant="secondary" className="bg-black/50 text-white">
              <Clock className="w-4 h-4 mr-1" />
              {formatDuration(sessionDuration)}
            </Badge>
            <Badge 
              variant="secondary" 
              className={`bg-black/50 ${getQualityColor(connectionQuality)}`}
            >
              <Wifi className="w-4 h-4 mr-1" />
              {connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}
            </Badge>
            {isRecording && (
              <Badge variant="destructive" className="bg-red-600 text-white animate-pulse">
                <Circle className="w-4 h-4 mr-1" />
                Recording (Encrypted)
              </Badge>
            )}
          </div>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={endSession}
            className="bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            End Call
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="absolute top-20 left-4 right-4 z-20">
          <Alert className="bg-red-900/90 border-red-600 text-white">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main video area */}
      <div className="flex h-screen">
        {/* Remote video */}
        <div className="flex-1 relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-gray-800"
          />
          
          {/* Screen share overlay */}
          {isScreenSharing && (
            <video
              ref={screenShareRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
          )}

          {/* Connection status overlay */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/75">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <p>Connecting to video session...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-20 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Video disabled overlay */}
          {!localVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex justify-center items-center gap-4">
          {/* Audio toggle */}
          <Button
            variant={localAudio ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-12 h-12"
          >
            {localAudio ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </Button>

          {/* Video toggle */}
          <Button
            variant={localVideo ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12"
          >
            {localVideo ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>

          {/* Screen share */}
          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="lg"
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className="rounded-full w-12 h-12"
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
          </Button>

          {/* Recording */}
          {participantInfo.role !== 'patient' && (
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="lg"
              onClick={isRecording ? stopRecording : startRecording}
              className="rounded-full w-12 h-12"
            >
              {isRecording ? <Square className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
            </Button>
          )}

          {/* Chat toggle */}
          <Button
            variant={showChat ? "default" : "secondary"}
            size="lg"
            onClick={() => setShowChat(!showChat)}
            className="rounded-full w-12 h-12"
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Chat panel with E2E encryption */}
      {showChat && session && (
        <div className="absolute right-4 top-20 bottom-20">
          <VideoChat
            sessionId={session.sessionId}
            currentUser={participantInfo}
            isVisible={showChat}
            onClose={() => setShowChat(false)}
            videoService={hipaaVideoServiceRef.current || undefined}
          />
        </div>
      )}
    </div>
  );
}