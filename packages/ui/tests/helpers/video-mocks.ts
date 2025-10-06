import { vi } from 'vitest';
import { RefObject } from 'react';
import type { Participant, VideoSession, VideoError } from '../../src/video/VideoConferencing';

/**
 * Mock video stream for testing
 */
export const createMockMediaStream = (): MediaStream => {
  const stream = {
    getTracks: vi.fn(() => []),
    getVideoTracks: vi.fn(() => []),
    getAudioTracks: vi.fn(() => []),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    active: true,
    id: 'mock-stream-id',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaStream;

  return stream;
};

/**
 * Mock video element ref for testing
 */
export const createMockVideoRef = (): RefObject<HTMLVideoElement> => {
  const videoElement = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    srcObject: null,
    currentTime: 0,
    duration: 100,
    paused: false,
    muted: false,
    volume: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLVideoElement;

  return { current: videoElement };
};

/**
 * Mock participant for testing
 */
export const createMockParticipant = (overrides: Partial<Participant> = {}): Participant => ({
  id: 'participant-1',
  name: 'Test Participant',
  role: 'patient',
  status: 'joined',
  videoEnabled: true,
  audioEnabled: true,
  isScreenSharing: false,
  ...overrides,
});

/**
 * Mock video session for testing
 */
export const createMockVideoSession = (overrides: Partial<VideoSession> = {}): VideoSession => ({
  id: 'session-1',
  sessionId: 'session-1',
  token: 'mock-token',
  participants: [createMockParticipant()],
  settings: {
    recordSession: false,
    enableChat: true,
    enableScreenShare: true,
    hipaaCompliant: true,
  },
  ...overrides,
});

/**
 * Mock video error for testing
 */
export const createMockVideoError = (overrides: Partial<VideoError> = {}): VideoError => ({
  code: 'TEST_ERROR',
  message: 'Test error message',
  recoverable: true,
  ...overrides,
});

/**
 * Mock VideoConferencing props with all required callbacks
 */
export const createMockVideoConferencingProps = (overrides: any = {}) => ({
  session: createMockVideoSession(),
  isConnected: true,
  isConnecting: false,
  localVideo: true,
  localAudio: true,
  localStream: createMockMediaStream(),
  remoteStream: createMockMediaStream(),
  screenStream: null,
  connectionQuality: 'excellent' as const,
  sessionDuration: 120,
  isRecording: false,
  isScreenSharing: false,
  isEncrypted: true,
  participants: [createMockParticipant()],
  error: null,
  localVideoRef: createMockVideoRef(),
  remoteVideoRef: createMockVideoRef(),
  screenShareRef: createMockVideoRef(),
  onToggleVideo: vi.fn(),
  onToggleAudio: vi.fn(),
  onStartScreenShare: vi.fn().mockResolvedValue(undefined),
  onStopScreenShare: vi.fn(),
  onStartRecording: vi.fn().mockResolvedValue(undefined),
  onStopRecording: vi.fn().mockResolvedValue(undefined),
  onEndSession: vi.fn().mockResolvedValue(undefined),
  onError: vi.fn(),
  participantInfo: {
    id: 'user-1',
    name: 'Test User',
    role: 'patient' as const,
  },
  ...overrides,
});

/**
 * Mock chat message for testing
 */
export const createMockChatMessage = (overrides: any = {}) => ({
  id: 'message-1',
  sender: {
    id: 'user-1',
    name: 'Test User',
    role: 'patient' as const,
  },
  content: 'Test message',
  timestamp: new Date(),
  type: 'text' as const,
  encrypted: true,
  encryptionVerified: true,
  ...overrides,
});

/**
 * Mock VideoChat props with all required callbacks
 */
export const createMockVideoChatProps = (overrides: any = {}) => ({
  sessionId: 'session-1',
  currentUser: {
    id: 'user-1',
    name: 'Test User',
    role: 'patient' as const,
  },
  isVisible: true,
  onClose: vi.fn(),
  messages: [createMockChatMessage()],
  isLoading: false,
  encryptionStatus: {
    ready: true,
    verified: true,
    channelState: 'open' as const,
  },
  typingUsers: [],
  unreadCount: 0,
  error: null,
  onSendMessage: vi.fn().mockResolvedValue(undefined),
  onTypingChange: vi.fn(),
  messagesEndRef: { current: document.createElement('div') },
  inputRef: { current: document.createElement('input') },
  ...overrides,
});

/**
 * Mock File for document upload testing
 */
export const createMockFile = (overrides: Partial<File> = {}): File => {
  const file = new File(['test content'], 'test-document.pdf', {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  // Add custom properties if needed
  Object.assign(file, overrides);
  return file;
};

/**
 * Mock image file for document upload testing
 */
export const createMockImageFile = (overrides: Partial<File> = {}): File => {
  const defaultOptions = {
    type: 'image/jpeg',
    lastModified: Date.now(),
    ...overrides,
  };

  // Use the name from overrides or default
  const fileName = (overrides as any).name || 'test-image.jpg';

  const file = new File(['image content'], fileName, defaultOptions);

  return file;
};

/**
 * Mock document type for testing
 */
export const createMockDocumentType = (overrides: any = {}) => ({
  id: 'doc-type-1',
  name: 'Test Document',
  required: true,
  type: 'identity',
  description: 'Test document description',
  examples: ['Example 1', 'Example 2'],
  tips: 'Test tips for uploading',
  ...overrides,
});

/**
 * Mock EnhancedDocumentUpload props
 */
export const createMockDocumentUploadProps = (overrides: any = {}) => ({
  documentType: createMockDocumentType(),
  onFileSelect: vi.fn(),
  onUploadProgress: vi.fn(),
  uploadStatus: 'idle' as const,
  uploadMessage: '',
  maxSizeMB: 10,
  acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  ...overrides,
});

/**
 * Setup global mocks for video/media APIs
 */
export const setupVideoMocks = () => {
  // Mock getUserMedia
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue(createMockMediaStream()),
    getDisplayMedia: vi.fn().mockResolvedValue(createMockMediaStream()),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  } as any;

  // Mock URL.createObjectURL for file previews
  global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock FileReader for document processing
  global.FileReader = class {
    readAsDataURL = vi.fn();
    readAsText = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    result = 'mock-result';
  } as any;
};

/**
 * Cleanup video mocks
 */
export const cleanupVideoMocks = () => {
  vi.clearAllMocks();
};