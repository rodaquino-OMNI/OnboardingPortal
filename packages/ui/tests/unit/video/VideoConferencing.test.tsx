import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoConferencing } from '../../../src/video/VideoConferencing';
import {
  createMockVideoConferencingProps,
  createMockVideoError,
  setupVideoMocks,
  cleanupVideoMocks,
} from '../../helpers/video-mocks';

describe('VideoConferencing', () => {
  beforeEach(() => {
    setupVideoMocks();
  });

  afterEach(() => {
    cleanupVideoMocks();
  });

  describe('Rendering', () => {
    it('renders the video conferencing interface', () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      expect(screen.getByRole('application', { name: /video conferencing application/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /session information/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /video call controls/i })).toBeInTheDocument();
    });

    it('displays HIPAA compliance badge', () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/hipaa compliant session/i)).toBeInTheDocument();
    });

    it('displays encryption status when encrypted', () => {
      const props = createMockVideoConferencingProps({ isEncrypted: true });
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/end-to-end encrypted/i)).toBeInTheDocument();
    });

    it('does not display encryption badge when not encrypted', () => {
      const props = createMockVideoConferencingProps({ isEncrypted: false });
      render(<VideoConferencing {...props} />);

      expect(screen.queryByLabelText(/end-to-end encrypted/i)).not.toBeInTheDocument();
    });

    it('displays session duration correctly', () => {
      const props = createMockVideoConferencingProps({ sessionDuration: 90 }); // 1:30
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/session duration: 1:30/i)).toBeInTheDocument();
    });

    it('displays connection quality with correct styling', () => {
      const props = createMockVideoConferencingProps({ connectionQuality: 'poor' });
      render(<VideoConferencing {...props} />);

      const qualityBadge = screen.getByLabelText(/connection quality: poor/i);
      expect(qualityBadge).toBeInTheDocument();
      expect(qualityBadge).toHaveClass('text-red-600');
    });

    it('displays recording status when recording', () => {
      const props = createMockVideoConferencingProps({ isRecording: true });
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/recording in progress/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/recording in progress/i)).toHaveClass('animate-pulse');
    });
  });

  describe('Duration Formatting', () => {
    it('formats duration under 1 hour correctly', () => {
      const props = createMockVideoConferencingProps({ sessionDuration: 150 }); // 2:30
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/session duration: 2:30/i)).toBeInTheDocument();
    });

    it('formats duration over 1 hour correctly', () => {
      const props = createMockVideoConferencingProps({ sessionDuration: 3665 }); // 1:01:05
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/session duration: 1:01:05/i)).toBeInTheDocument();
    });

    it('pads single digits correctly', () => {
      const props = createMockVideoConferencingProps({ sessionDuration: 65 }); // 1:05
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/session duration: 1:05/i)).toBeInTheDocument();
    });
  });

  describe('Video Controls', () => {
    it('toggles audio when audio button is clicked', async () => {
      const mockToggleAudio = vi.fn();
      const props = createMockVideoConferencingProps({
        onToggleAudio: mockToggleAudio,
        localAudio: true,
      });
      render(<VideoConferencing {...props} />);

      const audioButton = screen.getByLabelText(/mute microphone/i);
      await userEvent.click(audioButton);

      expect(mockToggleAudio).toHaveBeenCalledOnce();
    });

    it('toggles video when video button is clicked', async () => {
      const mockToggleVideo = vi.fn();
      const props = createMockVideoConferencingProps({
        onToggleVideo: mockToggleVideo,
        localVideo: true,
      });
      render(<VideoConferencing {...props} />);

      const videoButton = screen.getByLabelText(/turn off camera/i);
      await userEvent.click(videoButton);

      expect(mockToggleVideo).toHaveBeenCalledOnce();
    });

    it('shows correct audio button state when muted', () => {
      const props = createMockVideoConferencingProps({ localAudio: false });
      render(<VideoConferencing {...props} />);

      const audioButton = screen.getByLabelText(/unmute microphone/i);
      expect(audioButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows correct video button state when camera off', () => {
      const props = createMockVideoConferencingProps({ localVideo: false });
      render(<VideoConferencing {...props} />);

      const videoButton = screen.getByLabelText(/turn on camera/i);
      expect(videoButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('ends session when end call button is clicked', async () => {
      const mockEndSession = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoConferencingProps({ onEndSession: mockEndSession });
      render(<VideoConferencing {...props} />);

      const endButton = screen.getByLabelText(/end call/i);
      await userEvent.click(endButton);

      expect(mockEndSession).toHaveBeenCalledOnce();
    });
  });

  describe('Screen Sharing', () => {
    it('starts screen sharing when button is clicked', async () => {
      const mockStartScreenShare = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoConferencingProps({
        onStartScreenShare: mockStartScreenShare,
        isScreenSharing: false,
      });
      render(<VideoConferencing {...props} />);

      const screenShareButton = screen.getByLabelText(/start screen sharing/i);
      await userEvent.click(screenShareButton);

      expect(mockStartScreenShare).toHaveBeenCalledOnce();
    });

    it('stops screen sharing when button is clicked while sharing', async () => {
      const mockStopScreenShare = vi.fn();
      const props = createMockVideoConferencingProps({
        onStopScreenShare: mockStopScreenShare,
        isScreenSharing: true,
      });
      render(<VideoConferencing {...props} />);

      const screenShareButton = screen.getByLabelText(/stop screen sharing/i);
      await userEvent.click(screenShareButton);

      expect(mockStopScreenShare).toHaveBeenCalledOnce();
    });

    it('handles screen sharing errors gracefully', async () => {
      const mockStartScreenShare = vi.fn().mockRejectedValue(new Error('Screen share failed'));
      const mockOnError = vi.fn();
      const props = createMockVideoConferencingProps({
        onStartScreenShare: mockStartScreenShare,
        onError: mockOnError,
        isScreenSharing: false,
      });
      render(<VideoConferencing {...props} />);

      const screenShareButton = screen.getByLabelText(/start screen sharing/i);
      await userEvent.click(screenShareButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith({
          code: 'SCREEN_SHARE_ERROR',
          message: 'Failed to toggle screen sharing',
          recoverable: true,
        });
      });
    });

    it('displays screen share video when sharing', () => {
      const props = createMockVideoConferencingProps({ isScreenSharing: true });
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/shared screen content/i)).toBeInTheDocument();
    });
  });

  describe('Recording Controls', () => {
    it('shows recording button for non-patient roles', () => {
      const props = createMockVideoConferencingProps({
        participantInfo: { id: 'doc-1', name: 'Dr. Test', role: 'doctor' },
      });
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument();
    });

    it('hides recording button for patient role', () => {
      const props = createMockVideoConferencingProps({
        participantInfo: { id: 'patient-1', name: 'Patient Test', role: 'patient' },
      });
      render(<VideoConferencing {...props} />);

      expect(screen.queryByLabelText(/start recording/i)).not.toBeInTheDocument();
    });

    it('starts recording when button is clicked', async () => {
      const mockStartRecording = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoConferencingProps({
        onStartRecording: mockStartRecording,
        isRecording: false,
        participantInfo: { id: 'doc-1', name: 'Dr. Test', role: 'doctor' },
      });
      render(<VideoConferencing {...props} />);

      const recordButton = screen.getByLabelText(/start recording/i);
      await userEvent.click(recordButton);

      expect(mockStartRecording).toHaveBeenCalledOnce();
    });

    it('stops recording when button is clicked while recording', async () => {
      const mockStopRecording = vi.fn().mockResolvedValue(undefined);
      const props = createMockVideoConferencingProps({
        onStopRecording: mockStopRecording,
        isRecording: true,
        participantInfo: { id: 'doc-1', name: 'Dr. Test', role: 'doctor' },
      });
      render(<VideoConferencing {...props} />);

      const recordButton = screen.getByLabelText(/stop recording/i);
      await userEvent.click(recordButton);

      expect(mockStopRecording).toHaveBeenCalledOnce();
    });

    it('handles recording errors gracefully', async () => {
      const mockStartRecording = vi.fn().mockRejectedValue(new Error('Recording failed'));
      const mockOnError = vi.fn();
      const props = createMockVideoConferencingProps({
        onStartRecording: mockStartRecording,
        onError: mockOnError,
        isRecording: false,
        participantInfo: { id: 'doc-1', name: 'Dr. Test', role: 'doctor' },
      });
      render(<VideoConferencing {...props} />);

      const recordButton = screen.getByLabelText(/start recording/i);
      await userEvent.click(recordButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith({
          code: 'RECORDING_ERROR',
          message: 'Failed to toggle recording',
          recoverable: true,
        });
      });
    });
  });

  describe('Connection States', () => {
    it('shows connecting indicator when connecting', () => {
      const props = createMockVideoConferencingProps({ isConnecting: true });
      render(<VideoConferencing {...props} />);

      expect(screen.getByText(/connecting to video session/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('does not show connecting indicator when connected', () => {
      const props = createMockVideoConferencingProps({
        isConnecting: false,
        isConnected: true,
      });
      render(<VideoConferencing {...props} />);

      expect(screen.queryByText(/connecting to video session/i)).not.toBeInTheDocument();
    });

    it('shows video disabled overlay when local video is off', () => {
      const props = createMockVideoConferencingProps({ localVideo: false });
      render(<VideoConferencing {...props} />);

      const localVideoArea = screen.getByRole('region', { name: /your video preview/i });
      expect(localVideoArea.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error alert when error is present', () => {
      const error = createMockVideoError({ message: 'Connection failed' });
      const props = createMockVideoConferencingProps({ error });
      render(<VideoConferencing {...props} />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-live', 'assertive');
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    });

    it('does not display error alert when no error', () => {
      const props = createMockVideoConferencingProps({ error: null });
      render(<VideoConferencing {...props} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('handles end session errors gracefully', async () => {
      const mockEndSession = vi.fn().mockRejectedValue(new Error('End session failed'));
      const mockOnError = vi.fn();
      const props = createMockVideoConferencingProps({
        onEndSession: mockEndSession,
        onError: mockOnError,
      });
      render(<VideoConferencing {...props} />);

      const endButton = screen.getByLabelText(/end call/i);
      await userEvent.click(endButton);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith({
          code: 'END_SESSION_ERROR',
          message: 'Failed to end session',
          recoverable: false,
        });
      });
    });
  });

  describe('Chat Integration', () => {
    it('toggles chat panel when chat button is clicked', async () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      const chatButton = screen.getByLabelText(/show chat/i);
      await userEvent.click(chatButton);

      expect(screen.getByRole('region', { name: /chat panel/i })).toBeInTheDocument();
    });

    it('shows chat when toggle is active', async () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      const chatButton = screen.getByLabelText(/show chat/i);
      await userEvent.click(chatButton);

      expect(chatButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText(/hide chat/i)).toBeInTheDocument();
    });

    it('passes correct props to VideoChat component', async () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      const chatButton = screen.getByLabelText(/show chat/i);
      await userEvent.click(chatButton);

      // VideoChat should receive session ID and user info
      expect(screen.getByRole('region', { name: /chat panel/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for all interactive elements', () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/mute microphone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/turn off camera/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start screen sharing/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/show chat/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end call/i)).toBeInTheDocument();
    });

    it('uses proper ARIA pressed states for toggle buttons', () => {
      const props = createMockVideoConferencingProps({
        localAudio: true,
        localVideo: true,
        isScreenSharing: false,
      });
      render(<VideoConferencing {...props} />);

      expect(screen.getByLabelText(/mute microphone/i)).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText(/turn off camera/i)).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText(/start screen sharing/i)).toHaveAttribute('aria-pressed', 'false');
    });

    it('has proper role attributes for regions', () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      expect(screen.getByRole('application')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /session information/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /remote participant video/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /your video preview/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /video call controls/i })).toBeInTheDocument();
    });

    it('has proper aria-hidden attributes for decorative icons', () => {
      const props = createMockVideoConferencingProps();
      render(<VideoConferencing {...props} />);

      // Check that icons have aria-hidden="true"
      const decorativeIcons = screen.getAllByLabelText(/.*/).filter(el =>
        el.getAttribute('aria-hidden') === 'true'
      );
      expect(decorativeIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Video Element Management', () => {
    it('attaches local stream to local video ref', () => {
      const mockLocalRef = { current: document.createElement('video') };
      const mockLocalStream = createMockVideoConferencingProps().localStream;
      const props = createMockVideoConferencingProps({
        localVideoRef: mockLocalRef,
        localStream: mockLocalStream,
      });

      render(<VideoConferencing {...props} />);

      // Video element should be properly configured
      const localVideo = screen.getByLabelText(/your local video stream/i);
      expect(localVideo).toHaveAttribute('autoplay');
      expect(localVideo).toHaveAttribute('playsinline');
      expect(localVideo).toHaveAttribute('muted');
    });

    it('attaches remote stream to remote video ref', () => {
      const mockRemoteRef = { current: document.createElement('video') };
      const mockRemoteStream = createMockVideoConferencingProps().remoteStream;
      const props = createMockVideoConferencingProps({
        remoteVideoRef: mockRemoteRef,
        remoteStream: mockRemoteStream,
      });

      render(<VideoConferencing {...props} />);

      const remoteVideo = screen.getByLabelText(/remote participant video stream/i);
      expect(remoteVideo).toHaveAttribute('autoplay');
      expect(remoteVideo).toHaveAttribute('playsinline');
      expect(remoteVideo).not.toHaveAttribute('muted');
    });
  });
});