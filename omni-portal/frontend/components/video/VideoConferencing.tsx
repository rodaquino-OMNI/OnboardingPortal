"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Monitor, 
  MonitorStop,
  Users,
  Settings,
  MessageSquare,
  Camera,
  Volume2,
  VolumeX
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  stream?: MediaStream;
}

interface VideoConferencingProps {
  roomId: string;
  userId: string;
  userName: string;
  onCallEnd?: () => void;
  onParticipantJoin?: (participant: Participant) => void;
  onParticipantLeave?: (participantId: string) => void;
  className?: string;
  'data-testid'?: string;
}

export const VideoConferencing: React.FC<VideoConferencingProps> = ({
  roomId,
  userId,
  userName,
  onCallEnd,
  onParticipantJoin,
  onParticipantLeave,
  className = '',
  'data-testid': dataTestId,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<{ [key: string]: HTMLVideoElement }>({});

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: isAudioEnabled
      });

      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add local participant
      const localParticipant: Participant = {
        id: userId,
        name: userName,
        isLocal: true,
        videoEnabled: isVideoEnabled,
        audioEnabled: isAudioEnabled,
        stream
      };

      setParticipants(prev => [localParticipant, ...prev.filter(p => !p.isLocal)]);
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, [userId, userName, isVideoEnabled, isAudioEnabled]);

  // Connect to room
  const connectToRoom = useCallback(async () => {
    setConnectionStatus('connecting');
    
    try {
      const stream = await initializeMedia();
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Simulate remote participants joining
      setTimeout(() => {
        const remoteParticipant: Participant = {
          id: 'remote-1',
          name: 'Dr. Silva',
          isLocal: false,
          videoEnabled: true,
          audioEnabled: true
        };
        
        setParticipants(prev => [...prev, remoteParticipant]);
        onParticipantJoin?.(remoteParticipant);
      }, 2000);
      
    } catch (error) {
      console.error('Failed to connect to room:', error);
      setConnectionStatus('disconnected');
    }
  }, [initializeMedia, onParticipantJoin]);

  // Disconnect from room
  const disconnectFromRoom = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    setLocalStream(null);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setParticipants([]);
    
    onCallEnd?.();
  }, [localStream, onCallEnd]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
        
        // Update participant state
        setParticipants(prev => 
          prev.map(p => 
            p.isLocal ? { ...p, videoEnabled: !isVideoEnabled } : p
          )
        );
      }
    }
  }, [localStream, isVideoEnabled]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
        
        // Update participant state
        setParticipants(prev => 
          prev.map(p => 
            p.isLocal ? { ...p, audioEnabled: !isAudioEnabled } : p
          )
        );
      }
    }
  }, [localStream, isAudioEnabled]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(!isSpeakerEnabled);
  }, [isSpeakerEnabled]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace video track with screen share
        if (localStream) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = null; // In real implementation, get from peer connection
          
          // In a real implementation, you would replace the track in the peer connection
          setIsScreenSharing(true);
          
          // Handle screen share ending
          videoTrack.onended = () => {
            setIsScreenSharing(false);
            // Switch back to camera
            initializeMedia();
          };
        }
      } else {
        setIsScreenSharing(false);
        // Switch back to camera
        await initializeMedia();
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  }, [isScreenSharing, localStream, initializeMedia]);

  // Initialize component
  useEffect(() => {
    connectToRoom();
    
    return () => {
      disconnectFromRoom();
    };
  }, []);

  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipants = participants.filter(p => !p.isLocal);

  return (
    <div className={`video-conferencing h-full flex flex-col bg-gray-900 ${className}`} data-testid={dataTestId}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 text-white">
        <div className="flex items-center space-x-3">
          <Users className="h-5 w-5" />
          <span className="font-medium">Sala: {roomId}</span>
          <span className="text-sm text-gray-300">
            ({participants.length} participante{participants.length !== 1 ? 's' : ''})
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            connectionStatus === 'connected' ? 'bg-green-600' : 
            connectionStatus === 'connecting' ? 'bg-yellow-600' : 'bg-red-600'
          }`}>
            {connectionStatus === 'connected' ? 'Conectado' : 
             connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 flex">
        {/* Main video area */}
        <div className="flex-1 relative">
          {remoteParticipants.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 h-full p-4">
              {remoteParticipants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                  {participant.videoEnabled ? (
                    <video
                      ref={el => {
                        if (el) remoteVideosRef.current[participant.id] = el;
                      }}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-700">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                          <span className="text-2xl font-bold text-white">
                            {participant.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-white font-medium">{participant.name}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Participant info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="flex items-center justify-between text-white">
                      <span className="font-medium">{participant.name}</span>
                      <div className="flex items-center space-x-2">
                        {!participant.audioEnabled && <MicOff className="h-4 w-4 text-red-400" />}
                        {!participant.videoEnabled && <VideoOff className="h-4 w-4 text-red-400" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg">Aguardando outros participantes...</p>
                <p className="text-sm">Compartilhe o código da sala: <span className="font-mono">{roomId}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Local video (Picture-in-Picture) */}
        {localParticipant && (
          <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600 z-10">
            {localParticipant.videoEnabled ? (
              <video
                ref={localVideoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                autoPlay
                playsInline
                muted
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-1">
                    <span className="text-lg font-bold text-white">
                      {localParticipant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-white">{localParticipant.name}</p>
                </div>
              </div>
            )}
            
            {/* Local participant status */}
            <div className="absolute bottom-1 left-1 right-1">
              <div className="flex items-center justify-between text-white text-xs">
                <span>Você</span>
                <div className="flex items-center space-x-1">
                  {!localParticipant.audioEnabled && <MicOff className="h-3 w-3 text-red-400" />}
                  {!localParticipant.videoEnabled && <VideoOff className="h-3 w-3 text-red-400" />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-center space-x-4">
          {/* Audio toggle */}
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full transition-colors ${
              isAudioEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            disabled={!isConnected}
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Video toggle */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            disabled={!isConnected}
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen share toggle */}
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full transition-colors ${
              isScreenSharing
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            disabled={!isConnected}
          >
            {isScreenSharing ? <MonitorStop className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>

          {/* Speaker toggle */}
          <button
            onClick={toggleSpeaker}
            className={`p-3 rounded-full transition-colors ${
              isSpeakerEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            disabled={!isConnected}
          >
            {isSpeakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          {/* End call */}
          <button
            onClick={disconnectFromRoom}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoConferencing;