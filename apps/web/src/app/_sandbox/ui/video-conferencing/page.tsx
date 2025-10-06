'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, TestTube } from 'lucide-react';
import { VideoConferencing, Participant, VideoSession, VideoError } from '@onboarding-portal/ui/video/VideoConferencing';

// Mock data for sandbox testing
const mockParticipants: Participant[] = [
  {
    id: 'participant-1',
    name: 'Dr. Sarah Johnson',
    role: 'doctor',
    status: 'joined',
    videoEnabled: true,
    audioEnabled: true,
    isScreenSharing: false,
  },
  {
    id: 'participant-2',
    name: 'John Doe',
    role: 'patient',
    status: 'joined',
    videoEnabled: true,
    audioEnabled: true,
    isScreenSharing: false,
  },
];

const mockSession: VideoSession = {
  id: 'session-123',
  sessionId: 'sandbox-session',
  token: 'sandbox-token',
  participants: mockParticipants,
  settings: {
    recordSession: false,
    enableChat: true,
    enableScreenShare: true,
    hipaaCompliant: true,
  },
};

export default function VideoConferencingSandbox() {
  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);

  // Component state
  const [session] = useState<VideoSession>(mockSession);
  const [isConnected, setIsConnected] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localVideo, setLocalVideo] = useState(true);
  const [localAudio, setLocalAudio] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isEncrypted] = useState(true);
  const [error, setError] = useState<VideoError | null>(null);

  const participantInfo = {
    id: 'current-user',
    name: 'You (Sandbox)',
    role: 'doctor' as const,
  };

  // Simulate session duration
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Mock media stream for demo
  useEffect(() => {
    // Create a simple mock stream for demonstration
    if (localVideoRef.current && !localStream) {
      // In a real app, this would be getUserMedia()
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      // Draw a simple pattern
      if (ctx) {
        ctx.fillStyle = '#4F46E5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Local Video (Sandbox)', canvas.width / 2, canvas.height / 2);
      }

      const stream = canvas.captureStream(30);
      setLocalStream(stream);
      localVideoRef.current.srcObject = stream;
    }

    if (remoteVideoRef.current && !remoteStream) {
      // Mock remote stream
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#059669';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Remote Video (Sandbox)', canvas.width / 2, canvas.height / 2);
      }

      const stream = canvas.captureStream(30);
      setRemoteStream(stream);
      remoteVideoRef.current.srcObject = stream;
    }
  }, [localStream, remoteStream]);

  // Handlers
  const handleToggleVideo = () => {
    setLocalVideo(!localVideo);
  };

  const handleToggleAudio = () => {
    setLocalAudio(!localAudio);
  };

  const handleStartScreenShare = async () => {
    try {
      // Simulate screen share
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Screen Share (Sandbox)', canvas.width / 2, canvas.height / 2);
      }

      const stream = canvas.captureStream(30);
      setScreenStream(stream);
      setIsScreenSharing(true);

      if (screenShareRef.current) {
        screenShareRef.current.srcObject = stream;
      }
    } catch (err) {
      setError({
        code: 'SCREEN_SHARE_ERROR',
        message: 'Failed to start screen sharing',
        recoverable: true,
      });
    }
  };

  const handleStopScreenShare = () => {
    setIsScreenSharing(false);
    setScreenStream(null);
    if (screenShareRef.current) {
      screenShareRef.current.srcObject = null;
    }
  };

  const handleStartRecording = async () => {
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
  };

  const handleEndSession = async () => {
    setIsConnected(false);
    alert('Session ended (sandbox simulation)');
  };

  const handleError = (error: VideoError) => {
    setError(error);
    setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
  };

  const resetDemo = () => {
    setIsConnected(true);
    setLocalVideo(true);
    setLocalAudio(true);
    setIsRecording(false);
    setIsScreenSharing(false);
    setError(null);
    setSessionDuration(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/ui"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sandbox
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">VideoConferencing Component</h1>
          </div>
        </div>
        <button
          onClick={resetDemo}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Demo
        </button>
      </div>

      {/* Component Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Component Features</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Video Controls</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• Camera toggle with visual feedback</li>
              <li>• Microphone mute/unmute</li>
              <li>• Screen sharing capability</li>
              <li>• Picture-in-picture local video</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Security & Compliance</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• HIPAA compliant design</li>
              <li>• End-to-end encryption indicators</li>
              <li>• Secure recording features</li>
              <li>• Connection quality monitoring</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Live Component Demo */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Live Component Demo</h2>
          <p className="text-sm text-gray-600 mt-1">
            Interactive demo with mock video streams and full functionality
          </p>
        </div>

        <div className="relative" style={{ height: '600px' }}>
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
            participants={mockParticipants}
            error={error}
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            screenShareRef={screenShareRef}
            onToggleVideo={handleToggleVideo}
            onToggleAudio={handleToggleAudio}
            onStartScreenShare={handleStartScreenShare}
            onStopScreenShare={handleStopScreenShare}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onEndSession={handleEndSession}
            onError={handleError}
            participantInfo={participantInfo}
          />
        </div>
      </div>

      {/* Accessibility Notes */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2">Accessibility Features</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• ARIA labels for all interactive elements</li>
          <li>• Screen reader announcements for state changes</li>
          <li>• Keyboard navigation support</li>
          <li>• High contrast colors for visibility</li>
          <li>• Focus management for modal overlays</li>
        </ul>
      </div>
    </div>
  );
}