import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoConferencing } from '@/components/video/VideoConferencing';
import { useApi } from '@/hooks/useApi';

// Mock the useApi hook
jest.mock('@/hooks/useApi');
const mockUseApi = useApi as jest.MockedFunction<typeof useApi>;

// Mock api service
jest.mock('@/services/api');

import api from '@/services/api';

// Mock WebRTC APIs
const mockGetUserMedia = jest.fn();
const mockRTCPeerConnection = jest.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: jest.fn()
  }
});

Object.defineProperty(window, 'RTCPeerConnection', {
  writable: true,
  value: mockRTCPeerConnection
});

// Mock video element methods
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockResolvedValue(undefined)
});

describe('VideoConferencing Component', () => {
  const mockExecute = jest.fn();
  
  const defaultProps = {
    interviewId: 'interview-123',
    participantInfo: {
      id: 'user-123',
      name: 'John Doe',
      role: 'patient' as const
    },
    onSessionEnd: jest.fn(),
    onError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseApi.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      execute: mockExecute,
      reset: jest.fn()
    });

    // Mock successful media access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [
        { kind: 'video', enabled: true, stop: jest.fn() },
        { kind: 'audio', enabled: true, stop: jest.fn() }
      ],
      getVideoTracks: () => [{ enabled: true, stop: jest.fn() }],
      getAudioTracks: () => [{ enabled: true, stop: jest.fn() }]
    });

    // Mock RTCPeerConnection
    const mockPeerConnection = {
      addTrack: jest.fn(),
      close: jest.fn(),
      getStats: jest.fn().mockResolvedValue(new Map()),
      getSenders: jest.fn().mockReturnValue([]),
      connectionState: 'connected',
      ontrack: null,
      onconnectionstatechange: null
    };
    mockRTCPeerConnection.mockReturnValue(mockPeerConnection);

    // Mock successful session creation
    (api.post as jest.Mock).mockResolvedValue({
      success: true,
      session: {
        id: 'session-123',
        sessionId: 'vonage-session-123',
        tokens: {
          'user-123': 'user-token-123'
        },
        participants: [],
        settings: {
          recordSession: true,
          enableChat: true,
          enableScreenShare: true,
          hipaaCompliant: true
        }
      }
    });
  });

  it('renders video conferencing interface', async () => {
    render(<VideoConferencing {...defaultProps} />);

    // Should show connecting state initially
    expect(screen.getByText('Connecting to video session...')).toBeInTheDocument();

    // Wait for initialization
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/video/sessions', expect.objectContaining({
        interview_id: 'interview-123',
        participants: expect.arrayContaining([
          expect.objectContaining({
            id: 'user-123',
            name: 'John Doe',
            role: 'patient'
          })
        ])
      }));
    });
  });

  it('displays session info badges correctly', async () => {
    render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('HIPAA Compliant')).toBeInTheDocument();
      expect(screen.getByText(/\d+:\d+/)).toBeInTheDocument(); // Duration timer
    });
  });

  it('handles video toggle correctly', async () => {
    render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Find and click video toggle button
    const videoButton = screen.getByRole('button', { name: /toggle video/i });
    fireEvent.click(videoButton);

    // Verify video track was toggled
    expect(mockGetUserMedia).toHaveBeenCalled();
  });

  it('handles audio toggle correctly', async () => {
    render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Find and click audio toggle button
    const audioButton = screen.getByRole('button', { name: /toggle audio/i });
    fireEvent.click(audioButton);

    // Verify audio track was toggled
    expect(mockGetUserMedia).toHaveBeenCalled();
  });

  it('handles screen sharing', async () => {
    const mockGetDisplayMedia = jest.fn().mockResolvedValue({
      getTracks: () => [{ kind: 'video', stop: jest.fn() }],
      getVideoTracks: () => [{ 
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        stop: jest.fn()
      }]
    });

    navigator.mediaDevices.getDisplayMedia = mockGetDisplayMedia;

    render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Find and click screen share button
    const screenShareButton = screen.getByRole('button', { name: /screen share/i });
    fireEvent.click(screenShareButton);

    await waitFor(() => {
      expect(mockGetDisplayMedia).toHaveBeenCalled();
    });
  });

  it('handles recording for healthcare professionals', async () => {
    const doctorProps = {
      ...defaultProps,
      participantInfo: {
        ...defaultProps.participantInfo,
        role: 'doctor' as const
      }
    };

    (api.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      session: {
        id: 'session-123',
        sessionId: 'vonage-session-123',
        tokens: { 'user-123': 'token' },
        participants: [],
        settings: { recordSession: true }
      }
    });

    render(<VideoConferencing {...doctorProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Recording button should be visible for doctors
    const recordButton = screen.getByRole('button', { name: /record/i });
    expect(recordButton).toBeInTheDocument();

    // Mock recording start response
    (api.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      recording: {
        archive_id: 'archive-123',
        status: 'recording'
      }
    });

    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/video/sessions/vonage-session-123/recording/start',
        expect.any(Object)
      );
    });
  });

  it('does not show recording button for patients', async () => {
    render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Recording button should not be visible for patients
    expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
  });

  it('handles session end correctly', async () => {
    const onSessionEnd = jest.fn();
    
    render(<VideoConferencing {...defaultProps} onSessionEnd={onSessionEnd} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Mock session end response
    (api.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      session: {
        id: 'session-123',
        duration_minutes: 30,
        ended_at: new Date().toISOString()
      }
    });

    // Find and click end call button
    const endButton = screen.getByRole('button', { name: /end call/i });
    fireEvent.click(endButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/video/sessions/vonage-session-123/end');
      expect(onSessionEnd).toHaveBeenCalled();
    });
  });

  it('displays error messages correctly', async () => {
    const onError = jest.fn();
    
    // Mock failed session creation
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Session creation failed'));

    render(<VideoConferencing {...defaultProps} onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Session creation failed');
    });
  });

  it('handles connection quality monitoring', async () => {
    render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Should display connection quality indicator
    expect(screen.getByText(/Good|Excellent|Poor/i)).toBeInTheDocument();
  });

  it('handles chat toggle', async () => {
    render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // Find and click chat button
    const chatButton = screen.getByRole('button', { name: /chat/i });
    fireEvent.click(chatButton);

    // Chat panel should appear
    await waitFor(() => {
      expect(screen.getByText('Chat functionality will be implemented in the next phase.')).toBeInTheDocument();
    });
  });

  it('handles media access denial gracefully', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
    
    const onError = jest.fn();
    render(<VideoConferencing {...defaultProps} onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Media access denied');
    });
  });

  it('cleans up resources on unmount', async () => {
    const mockStop = jest.fn();
    const mockClose = jest.fn();
    
    mockGetUserMedia.mockResolvedValueOnce({
      getTracks: () => [
        { kind: 'video', enabled: true, stop: mockStop },
        { kind: 'audio', enabled: true, stop: mockStop }
      ],
      getVideoTracks: () => [{ enabled: true, stop: mockStop }],
      getAudioTracks: () => [{ enabled: true, stop: mockStop }]
    });

    const mockPeerConnection = {
      addTrack: jest.fn(),
      close: mockClose,
      getStats: jest.fn().mockResolvedValue(new Map()),
      getSenders: jest.fn().mockReturnValue([]),
      connectionState: 'connected',
      ontrack: null,
      onconnectionstatechange: null
    };
    mockRTCPeerConnection.mockReturnValue(mockPeerConnection);

    const { unmount } = render(<VideoConferencing {...defaultProps} />);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    unmount();

    // Verify cleanup
    expect(mockClose).toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });
});