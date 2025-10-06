'use client';

import { VideoConferencing } from '@repo/ui/video/VideoConferencing';
import { useVideoConferencingOrchestration } from '@/hooks/video';
import type { VideoError } from '@repo/ui/video/types';

interface VideoConferencingContainerProps {
  interviewId: string;
  participantInfo: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  onSessionEnd?: (sessionData: any) => void;
  onError?: (error: VideoError) => void;
}

/**
 * Container component that connects the video conferencing orchestration
 * to the pure UI component. Handles all state management and side effects.
 */
export function VideoConferencingContainer({
  interviewId,
  participantInfo,
  onSessionEnd,
  onError
}: VideoConferencingContainerProps) {
  // Use orchestration hook to manage all video conferencing state and logic
  const {
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
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    endSession
  } = useVideoConferencingOrchestration({
    interviewId,
    participantInfo,
    onSessionEnd,
    onError
  });

  // Pass all state and handlers to pure UI component
  return (
    <VideoConferencing
      session={session}
      isConnected={isConnected}
      isConnecting={isConnecting}
      localVideo={localVideo}
      localAudio={localAudio}
      localStream={localStream}
      remoteStream={remoteStream}
      screenStream={screenStream}
      connectionQuality={connectionQuality}
      sessionDuration={sessionDuration}
      isRecording={isRecording}
      isScreenSharing={isScreenSharing}
      isEncrypted={isEncrypted}
      participants={participants}
      error={error}
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}
      screenShareRef={screenShareRef}
      onToggleVideo={toggleVideo}
      onToggleAudio={toggleAudio}
      onStartScreenShare={startScreenShare}
      onStopScreenShare={stopScreenShare}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
      onEndSession={endSession}
      participantInfo={participantInfo}
    />
  );
}
