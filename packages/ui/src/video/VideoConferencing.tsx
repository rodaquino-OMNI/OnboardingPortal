'use client';

import { RefObject, useState } from 'react';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Monitor, MonitorOff, MessageCircle,
  Circle, Square,
  AlertTriangle, Shield, Clock, Wifi, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VideoChat } from './VideoChat';

// Type definitions for video conferencing
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
  // Session state
  session: VideoSession | null;
  isConnected: boolean;
  isConnecting: boolean;

  // Media state
  localVideo: boolean;
  localAudio: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Session info
  connectionQuality: 'excellent' | 'good' | 'poor';
  sessionDuration: number;
  isRecording: boolean;
  isScreenSharing: boolean;
  isEncrypted: boolean;
  participants: Participant[];

  // Error state
  error: VideoError | null;

  // Refs for video elements (DOM attachment)
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  screenShareRef: RefObject<HTMLVideoElement>;

  // Callbacks
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onStartScreenShare: () => Promise<void>;
  onStopScreenShare: () => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onEndSession: () => Promise<void>;
  onError?: (error: VideoError) => void;

  // Display
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
export function VideoConferencing({
  session,
  isConnected,
  isConnecting,
  localVideo,
  localAudio,
  localStream,
  remoteStream,
  screenStream,
  connectionQuality,
  sessionDuration,
  isRecording,
  isScreenSharing,
  isEncrypted,
  participants,
  error,
  localVideoRef,
  remoteVideoRef,
  screenShareRef,
  onToggleVideo,
  onToggleAudio,
  onStartScreenShare,
  onStopScreenShare,
  onStartRecording,
  onStopRecording,
  onEndSession,
  onError,
  participantInfo,
}: VideoConferencingProps) {
  // Only UI state (not business logic)
  const [showChat, setShowChat] = useState(false);

  // Helper: Format session duration for display
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper: Get connection quality color class
  const getQualityColor = (quality: string): string => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Handler: Handle screen share toggle
  const handleScreenShareToggle = async () => {
    try {
      if (isScreenSharing) {
        onStopScreenShare();
      } else {
        await onStartScreenShare();
      }
    } catch (err) {
      if (onError) {
        onError({
          code: 'SCREEN_SHARE_ERROR',
          message: 'Failed to toggle screen sharing',
          recoverable: true,
        });
      }
    }
  };

  // Handler: Handle recording toggle
  const handleRecordingToggle = async () => {
    try {
      if (isRecording) {
        await onStopRecording();
      } else {
        await onStartRecording();
      }
    } catch (err) {
      if (onError) {
        onError({
          code: 'RECORDING_ERROR',
          message: 'Failed to toggle recording',
          recoverable: true,
        });
      }
    }
  };

  // Handler: Handle end session
  const handleEndSession = async () => {
    try {
      await onEndSession();
    } catch (err) {
      if (onError) {
        onError({
          code: 'END_SESSION_ERROR',
          message: 'Failed to end session',
          recoverable: false,
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 relative" role="application" aria-label="Video conferencing application">
      {/* Header with session info */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4" role="region" aria-label="Session information">
            <Badge variant="secondary" className="bg-black/50 text-white" aria-label="HIPAA compliant session">
              <Shield className="w-4 h-4 mr-1" aria-hidden="true" />
              HIPAA Compliant
            </Badge>
            {isEncrypted && (
              <Badge variant="secondary" className="bg-green-600/90 text-white" aria-label="End-to-end encrypted">
                <Lock className="w-4 h-4 mr-1" aria-hidden="true" />
                E2E Encrypted
              </Badge>
            )}
            <Badge variant="secondary" className="bg-black/50 text-white" aria-label={`Session duration: ${formatDuration(sessionDuration)}`}>
              <Clock className="w-4 h-4 mr-1" aria-hidden="true" />
              {formatDuration(sessionDuration)}
            </Badge>
            <Badge
              variant="secondary"
              className={`bg-black/50 ${getQualityColor(connectionQuality)}`}
              aria-label={`Connection quality: ${connectionQuality}`}
            >
              <Wifi className="w-4 h-4 mr-1" aria-hidden="true" />
              {connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}
            </Badge>
            {isRecording && (
              <Badge variant="destructive" className="bg-red-600 text-white animate-pulse" aria-label="Recording in progress">
                <Circle className="w-4 h-4 mr-1" aria-hidden="true" />
                Recording (Encrypted)
              </Badge>
            )}
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndSession}
            className="bg-red-600 hover:bg-red-700"
            aria-label="End call"
          >
            <PhoneOff className="w-4 h-4 mr-2" aria-hidden="true" />
            End Call
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="absolute top-20 left-4 right-4 z-20" role="alert" aria-live="assertive">
          <Alert className="bg-red-900/90 border-red-600 text-white">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main video area */}
      <div className="flex h-screen">
        {/* Remote video */}
        <div className="flex-1 relative" role="region" aria-label="Remote participant video">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-gray-800"
            aria-label="Remote participant video stream"
          />

          {/* Screen share overlay */}
          {isScreenSharing && (
            <video
              ref={screenShareRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-contain bg-black"
              aria-label="Shared screen content"
            />
          )}

          {/* Connection status overlay */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/75" role="status" aria-live="polite">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" aria-hidden="true"></div>
                <p>Connecting to video session...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-20 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600" role="region" aria-label="Your video preview">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            aria-label="Your local video stream"
          />

          {/* Video disabled overlay */}
          {!localVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="w-8 h-8 text-gray-400" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4" role="region" aria-label="Video call controls">
        <div className="flex justify-center items-center gap-4">
          {/* Audio toggle */}
          <Button
            variant={localAudio ? "secondary" : "destructive"}
            size="lg"
            onClick={onToggleAudio}
            className="rounded-full w-12 h-12"
            aria-label={localAudio ? "Mute microphone" : "Unmute microphone"}
            aria-pressed={localAudio}
          >
            {localAudio ? <Mic className="w-6 h-6" aria-hidden="true" /> : <MicOff className="w-6 h-6" aria-hidden="true" />}
          </Button>

          {/* Video toggle */}
          <Button
            variant={localVideo ? "secondary" : "destructive"}
            size="lg"
            onClick={onToggleVideo}
            className="rounded-full w-12 h-12"
            aria-label={localVideo ? "Turn off camera" : "Turn on camera"}
            aria-pressed={localVideo}
          >
            {localVideo ? <Video className="w-6 h-6" aria-hidden="true" /> : <VideoOff className="w-6 h-6" aria-hidden="true" />}
          </Button>

          {/* Screen share */}
          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="lg"
            onClick={handleScreenShareToggle}
            className="rounded-full w-12 h-12"
            aria-label={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
            aria-pressed={isScreenSharing}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" aria-hidden="true" /> : <Monitor className="w-6 h-6" aria-hidden="true" />}
          </Button>

          {/* Recording */}
          {participantInfo.role !== 'patient' && (
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="lg"
              onClick={handleRecordingToggle}
              className="rounded-full w-12 h-12"
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              aria-pressed={isRecording}
            >
              {isRecording ? <Square className="w-6 h-6" aria-hidden="true" /> : <Circle className="w-6 h-6" aria-hidden="true" />}
            </Button>
          )}

          {/* Chat toggle */}
          <Button
            variant={showChat ? "default" : "secondary"}
            size="lg"
            onClick={() => setShowChat(!showChat)}
            className="rounded-full w-12 h-12"
            aria-label={showChat ? "Hide chat" : "Show chat"}
            aria-pressed={showChat}
          >
            <MessageCircle className="w-6 h-6" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Chat panel */}
      {showChat && session && (
        <div className="absolute right-4 top-20 bottom-20" role="region" aria-label="Chat panel">
          <VideoChat
            sessionId={session.sessionId}
            currentUser={participantInfo}
            isVisible={showChat}
            onClose={() => setShowChat(false)}
          />
        </div>
      )}
    </div>
  );
}