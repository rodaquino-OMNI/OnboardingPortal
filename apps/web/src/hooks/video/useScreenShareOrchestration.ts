/**
 * useScreenShareOrchestration Hook
 *
 * Manages screen sharing lifecycle, permissions, and track replacement
 * for video conferencing. Can be used standalone or composed with other hooks.
 */

import { useState, useRef, useCallback, type RefObject } from 'react';
import { HIPAAVideoService } from '@/lib/video-conferencing/HIPAAVideoService';

export interface ScreenShareOrchestrationConfig {
  videoService: HIPAAVideoService;
  onScreenShareStart?: () => void;
  onScreenShareStop?: () => void;
  onScreenShareError?: (error: Error) => void;
}

export interface ScreenShareOrchestrationReturn {
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  screenShareRef: RefObject<HTMLVideoElement>;

  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;

  error: Error | null;
}

export function useScreenShareOrchestration(
  config: ScreenShareOrchestrationConfig
): ScreenShareOrchestrationReturn {
  const {
    videoService,
    onScreenShareStart,
    onScreenShareStop,
    onScreenShareError,
  } = config;

  // State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      setError(null);

      // Request screen sharing permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      if (!mountedRef.current) {
        // Component unmounted, clean up stream
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Store stream
      setScreenStream(stream);

      // Attach to video element
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = stream;
      }

      // Replace video track in peer connection
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        // Store local stream for restoration later
        if (!localStreamRef.current) {
          localStreamRef.current = videoService.getLocalStream();
        }

        await videoService.replaceVideoTrack(videoTrack);
      }

      setIsScreenSharing(true);
      onScreenShareStart?.();

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (mountedRef.current) {
          stopScreenShare();
        }
      });

    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error('Failed to start screen sharing');

      setError(error);
      onScreenShareError?.(error);

      console.error('Screen sharing error:', error);
    }
  }, [videoService, onScreenShareStart, onScreenShareError]);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    try {
      // Stop all screen share tracks
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          track.stop();
        });
        setScreenStream(null);
      }

      // Clear video element
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = null;
      }

      // Restore original video track
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          await videoService.replaceVideoTrack(videoTrack);
        }
      }

      setIsScreenSharing(false);
      onScreenShareStop?.();

    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error('Failed to stop screen sharing');

      setError(error);
      onScreenShareError?.(error);

      console.error('Error stopping screen share:', error);
    }
  }, [screenStream, videoService, onScreenShareStop, onScreenShareError]);

  return {
    isScreenSharing,
    screenStream,
    screenShareRef,
    startScreenShare,
    stopScreenShare,
    error,
  };
}
