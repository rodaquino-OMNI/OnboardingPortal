# Video Orchestration Hook Architecture

## Executive Summary

This document defines the orchestration layer architecture for video conferencing and chat features. The architecture separates **presentational UI components** from **orchestration logic** using custom React hooks, enabling better testability, reusability, and maintainability.

---

## 1. Architecture Principles

### 1.1 Separation of Concerns
- **UI Components** (in `packages/ui/src/video/`) - Pure presentational components
- **Orchestration Hooks** (in app layer) - Business logic, WebRTC, state management
- **Services** (HIPAAVideoService) - Low-level WebRTC and encryption primitives

### 1.2 Hook-Based Architecture Benefits
1. **Testability**: Hooks can be tested independently without rendering components
2. **Reusability**: Multiple components can share orchestration logic
3. **Composability**: Hooks can be composed to build complex features
4. **Type Safety**: Strong TypeScript contracts between layers
5. **Performance**: Fine-grained state updates and memoization

### 1.3 Design Pattern: Container/Presenter
```
┌─────────────────────────────────────────────────┐
│           App Layer (Container)                  │
│  ┌─────────────────────────────────────────┐    │
│  │  Orchestration Hooks                     │    │
│  │  - useVideoConferencingOrchestration()   │    │
│  │  - useVideoChatOrchestration()           │    │
│  │  - useScreenShareOrchestration()         │    │
│  └─────────────────────────────────────────┘    │
│              ↓ Props/Callbacks ↓                 │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│        UI Package (Presenter)                    │
│  ┌─────────────────────────────────────────┐    │
│  │  Presentational Components               │    │
│  │  - <VideoConferencing />                 │    │
│  │  - <VideoChat />                         │    │
│  │  - <ScreenShare />                       │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 2. Orchestration Hook Specifications

### 2.1 `useVideoConferencingOrchestration()`

#### Purpose
Manages WebRTC connections, media streams, session lifecycle, and HIPAA compliance for video conferencing.

#### Interface Definition
```typescript
interface VideoConferencingOrchestrationConfig {
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

interface VideoConferencingOrchestrationReturn {
  // Session State
  session: VideoSession | null;
  isConnected: boolean;
  isConnecting: boolean;
  sessionDuration: number;
  connectionQuality: 'excellent' | 'good' | 'poor';
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

function useVideoConferencingOrchestration(
  config: VideoConferencingOrchestrationConfig
): VideoConferencingOrchestrationReturn;
```

#### Usage Example
```typescript
// In app layer component (Container)
function VideoConferencingContainer({ interviewId, participantInfo }) {
  const orchestration = useVideoConferencingOrchestration({
    interviewId,
    participantInfo,
    settings: {
      autoStartVideo: true,
      autoStartAudio: true,
      enableRecording: true,
    },
    onSessionEnd: (data) => {
      router.push(`/interviews/${interviewId}/summary`);
    },
    onError: (error) => {
      toast.error('Video Error', error.message);
    },
  });

  return (
    <VideoConferencing
      {...orchestration}
      onToggleVideo={orchestration.toggleVideo}
      onToggleAudio={orchestration.toggleAudio}
      onEndCall={orchestration.endSession}
    />
  );
}
```

#### State Management Strategy
- **Local State**: Media controls (video/audio on/off), UI visibility
- **Ref State**: Video elements, WebRTC connections, timers
- **Effect State**: Session initialization, WebRTC setup, cleanup
- **Derived State**: Connection quality, session duration, participant count

#### Error Handling Pattern
```typescript
type VideoErrorType =
  | 'SESSION_INIT_FAILED'
  | 'WEBRTC_CONNECTION_FAILED'
  | 'MEDIA_PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'ENCRYPTION_FAILED'
  | 'RECORDING_FAILED';

interface VideoError {
  type: VideoErrorType;
  message: string;
  recoverable: boolean;
  metadata?: Record<string, any>;
}
```

---

### 2.2 `useVideoChatOrchestration()`

#### Purpose
Manages encrypted chat messaging, typing indicators, message persistence, and data channel communication.

#### Interface Definition
```typescript
interface VideoChatOrchestrationConfig {
  sessionId: string;
  currentUser: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };
  videoService?: HIPAAVideoService;
  settings?: {
    enableTypingIndicators?: boolean;
    enableMessagePersistence?: boolean;
    maxMessageLength?: number;
  };
  onMessageReceived?: (message: ChatMessage) => void;
  onEncryptionStatusChange?: (encrypted: boolean) => void;
}

interface VideoChatOrchestrationReturn {
  // Messages State
  messages: ChatMessage[];
  unreadCount: number;
  isEncryptionReady: boolean;
  dataChannelState: 'connecting' | 'open' | 'closed';

  // Typing State
  isTyping: boolean;
  typingUsers: string[];

  // Message Actions
  sendMessage: (content: string, type?: MessageType) => Promise<void>;
  sendEmergencyMessage: () => Promise<void>;
  markAsRead: (messageId: string) => void;
  deleteMessage: (messageId: string) => Promise<void>;

  // UI State
  newMessage: string;
  setNewMessage: (value: string) => void;
  isSending: boolean;

  // Refs
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;

  // Utilities
  loadChatHistory: () => Promise<void>;
  clearMessages: () => void;
}

function useVideoChatOrchestration(
  config: VideoChatOrchestrationConfig
): VideoChatOrchestrationReturn;
```

#### Usage Example
```typescript
// In app layer component
function VideoChatContainer({ sessionId, currentUser, videoService }) {
  const chat = useVideoChatOrchestration({
    sessionId,
    currentUser,
    videoService,
    settings: {
      enableTypingIndicators: true,
      maxMessageLength: 500,
    },
    onMessageReceived: (message) => {
      if (message.type === 'emergency') {
        notifyEmergencyTeam(message);
      }
    },
  });

  return (
    <VideoChat
      messages={chat.messages}
      onSendMessage={chat.sendMessage}
      isEncrypted={chat.isEncryptionReady}
      typingUsers={chat.typingUsers}
      messagesEndRef={chat.messagesEndRef}
      inputRef={chat.inputRef}
    />
  );
}
```

#### Message Flow Architecture
```typescript
// Encryption-aware message routing
type MessageTransport = 'data-channel' | 'api-fallback';

const getMessageTransport = (
  isEncryptionReady: boolean,
  videoService: HIPAAVideoService | undefined
): MessageTransport => {
  return isEncryptionReady && videoService ? 'data-channel' : 'api-fallback';
};

// Message sending logic
const sendMessage = async (content: string, type: MessageType = 'text') => {
  const transport = getMessageTransport(isEncryptionReady, videoService);

  if (transport === 'data-channel') {
    // E2E encrypted via WebRTC data channel
    await videoService.sendEncryptedMessage(JSON.stringify({
      content,
      type,
      sender: currentUser,
      timestamp: Date.now(),
    }));
  } else {
    // Server-side encrypted via API
    await api.post(`/api/video/sessions/${sessionId}/chat`, {
      content,
      type,
    });
  }
};
```

---

### 2.3 `useScreenShareOrchestration()`

#### Purpose
Manages screen sharing lifecycle, permissions, and track replacement for video conferencing.

#### Interface Definition
```typescript
interface ScreenShareOrchestrationConfig {
  videoService: HIPAAVideoService;
  onScreenShareStart?: () => void;
  onScreenShareStop?: () => void;
  onScreenShareError?: (error: Error) => void;
}

interface ScreenShareOrchestrationReturn {
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  screenShareRef: RefObject<HTMLVideoElement>;

  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;

  error: Error | null;
}

function useScreenShareOrchestration(
  config: ScreenShareOrchestrationConfig
): ScreenShareOrchestrationReturn;
```

---

## 3. Prop Interface Design for UI Components

### 3.1 `<VideoConferencing />` Props
```typescript
interface VideoConferencingProps {
  // Session State (from orchestration)
  session: VideoSession | null;
  isConnected: boolean;
  isConnecting: boolean;
  sessionDuration: number;
  connectionQuality: 'excellent' | 'good' | 'poor';
  isEncrypted: boolean;
  participants: Participant[];

  // Media State
  localVideo: boolean;
  localAudio: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;

  // Video Refs
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  screenShareRef: RefObject<HTMLVideoElement>;

  // Callbacks (UI → Orchestration)
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onStartScreenShare: () => Promise<void>;
  onStopScreenShare: () => Promise<void>;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onEndCall: () => Promise<void>;
  onToggleChat?: () => void;

  // Error State
  error: VideoError | null;
  onClearError?: () => void;

  // UI Customization
  className?: string;
  showParticipantsList?: boolean;
  showConnectionQuality?: boolean;
  enableChatButton?: boolean;
}
```

### 3.2 `<VideoChat />` Props
```typescript
interface VideoChatProps {
  // Messages
  messages: ChatMessage[];
  isEncrypted: boolean;
  dataChannelState: 'connecting' | 'open' | 'closed';

  // Typing State
  typingUsers: string[];

  // Callbacks
  onSendMessage: (content: string) => Promise<void>;
  onSendEmergencyMessage?: () => Promise<void>;
  onClose?: () => void;

  // Refs
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;

  // UI State
  isVisible: boolean;
  isSending?: boolean;

  // Current User
  currentUser: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'moderator';
  };

  // UI Customization
  className?: string;
  maxHeight?: string;
  enableEmergencyButton?: boolean;
}
```

---

## 4. Directory Structure

```
OnboardingPortal/
├── packages/
│   └── ui/
│       └── src/
│           └── video/
│               ├── VideoConferencing.tsx    # Presentational component
│               ├── VideoChat.tsx             # Presentational component
│               └── ScreenShare.tsx           # Presentational component
│
├── apps/
│   └── web/                                  # Or your main app directory
│       └── src/
│           ├── hooks/
│           │   └── video/
│           │       ├── useVideoConferencingOrchestration.ts
│           │       ├── useVideoChatOrchestration.ts
│           │       ├── useScreenShareOrchestration.ts
│           │       ├── useVideoRecording.ts
│           │       └── useConnectionQuality.ts
│           │
│           ├── containers/
│           │   └── video/
│           │       ├── VideoConferencingContainer.tsx
│           │       └── VideoChatContainer.tsx
│           │
│           └── lib/
│               └── video-conferencing/
│                   ├── HIPAAVideoService.ts   # Low-level service
│                   └── types.ts
```

### Directory Naming Conventions
- **`hooks/video/`** - Orchestration hooks (business logic)
- **`containers/video/`** - Container components that use hooks
- **`packages/ui/src/video/`** - Presentational components (UI-only)
- **`lib/video-conferencing/`** - Low-level services and utilities

---

## 5. State Management Patterns

### 5.1 Derived State Example
```typescript
// In useVideoConferencingOrchestration
const connectionQuality = useMemo(() => {
  if (!stats) return 'good';

  const { packetLoss, jitter, roundTripTime } = stats;

  if (packetLoss > 5 || jitter > 100 || roundTripTime > 500) {
    return 'poor';
  } else if (packetLoss > 2 || jitter > 50 || roundTripTime > 200) {
    return 'good';
  }
  return 'excellent';
}, [stats]);
```

### 5.2 Memoized Callbacks
```typescript
const toggleVideo = useCallback(() => {
  if (!videoServiceRef.current) return;

  const newState = !localVideo;
  videoServiceRef.current.toggleLocalVideo(newState);
  setLocalVideo(newState);

  // Track analytics
  analytics.track('video_toggled', {
    enabled: newState,
    sessionId: session?.sessionId,
  });
}, [localVideo, session]);
```

### 5.3 Effect Cleanup Pattern
```typescript
useEffect(() => {
  const mounted = { current: true };

  const initialize = async () => {
    if (!mounted.current) return;

    try {
      await setupWebRTC();
    } catch (error) {
      if (mounted.current) {
        handleError(error);
      }
    }
  };

  initialize();

  return () => {
    mounted.current = false;
    cleanup();
  };
}, []);
```

---

## 6. Testing Strategy

### 6.1 Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react';
import { useVideoConferencingOrchestration } from './useVideoConferencingOrchestration';

describe('useVideoConferencingOrchestration', () => {
  it('initializes session on mount', async () => {
    const { result } = renderHook(() =>
      useVideoConferencingOrchestration({
        interviewId: '123',
        participantInfo: mockParticipant,
      })
    );

    expect(result.current.isConnecting).toBe(true);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.session).toBeDefined();
    });
  });

  it('toggles video on/off', async () => {
    const { result } = renderHook(() =>
      useVideoConferencingOrchestration({
        interviewId: '123',
        participantInfo: mockParticipant,
      })
    );

    expect(result.current.localVideo).toBe(true);

    act(() => {
      result.current.toggleVideo();
    });

    expect(result.current.localVideo).toBe(false);
  });

  it('cleans up resources on unmount', async () => {
    const { unmount } = renderHook(() =>
      useVideoConferencingOrchestration({
        interviewId: '123',
        participantInfo: mockParticipant,
      })
    );

    const stopSpy = jest.spyOn(MediaStreamTrack.prototype, 'stop');

    unmount();

    expect(stopSpy).toHaveBeenCalled();
  });
});
```

### 6.2 Component Testing (UI)
```typescript
import { render, screen } from '@testing-library/react';
import { VideoConferencing } from './VideoConferencing';

describe('VideoConferencing', () => {
  it('renders controls correctly', () => {
    const mockProps = {
      localVideo: true,
      localAudio: true,
      onToggleVideo: jest.fn(),
      onToggleAudio: jest.fn(),
      // ... other props
    };

    render(<VideoConferencing {...mockProps} />);

    expect(screen.getByLabelText('Mute microphone')).toBeInTheDocument();
    expect(screen.getByLabelText('Turn off camera')).toBeInTheDocument();
  });

  it('calls callbacks when buttons clicked', async () => {
    const onToggleVideo = jest.fn();

    render(<VideoConferencing {...mockProps} onToggleVideo={onToggleVideo} />);

    await userEvent.click(screen.getByLabelText('Turn off camera'));

    expect(onToggleVideo).toHaveBeenCalledTimes(1);
  });
});
```

---

## 7. Error Handling Patterns

### 7.1 Recoverable vs Non-Recoverable Errors
```typescript
const handleVideoError = useCallback((error: VideoError) => {
  setError(error);

  if (error.recoverable) {
    // Attempt automatic recovery
    if (error.type === 'WEBRTC_CONNECTION_FAILED') {
      setTimeout(() => reconnect(), 2000);
    }
  } else {
    // Non-recoverable - notify user
    onError?.(error);
  }

  // Log to monitoring service
  logger.error('Video error', {
    type: error.type,
    message: error.message,
    sessionId: session?.sessionId,
    metadata: error.metadata,
  });
}, [session, onError]);
```

### 7.2 Timeout Handling
```typescript
const startSessionWithTimeout = useCallback(async () => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Session start timeout')), 15000)
  );

  try {
    await Promise.race([
      initializeSession(),
      timeoutPromise,
    ]);
  } catch (error) {
    handleVideoError({
      type: 'SESSION_INIT_FAILED',
      message: error.message,
      recoverable: true,
    });
  }
}, []);
```

---

## 8. Performance Optimization

### 8.1 Memoization Strategy
```typescript
// Memoize expensive computations
const participantList = useMemo(() => {
  return participants
    .filter(p => p.status === 'joined')
    .sort((a, b) => a.name.localeCompare(b.name));
}, [participants]);

// Memoize callbacks to prevent re-renders
const handleParticipantAction = useCallback((participantId: string, action: string) => {
  // Handle action
}, []);
```

### 8.2 Lazy Loading
```typescript
// Lazy load chat component
const VideoChat = lazy(() => import('./VideoChat'));

// In UI component
{showChat && (
  <Suspense fallback={<ChatLoadingSpinner />}>
    <VideoChat {...chatProps} />
  </Suspense>
)}
```

### 8.3 Debouncing
```typescript
// Debounce typing indicators
const debouncedTyping = useMemo(
  () => debounce((typing: boolean) => {
    api.post(`/api/video/sessions/${sessionId}/typing`, { typing });
  }, 300),
  [sessionId]
);
```

---

## 9. Callback Patterns (UI → Orchestration)

### 9.1 Simple Actions
```typescript
// UI Component
<Button onClick={onToggleVideo}>
  {localVideo ? <Video /> : <VideoOff />}
</Button>

// Orchestration Hook
const toggleVideo = useCallback(() => {
  setLocalVideo(prev => !prev);
  videoService.toggleLocalVideo(!localVideo);
}, [localVideo, videoService]);
```

### 9.2 Async Actions with Loading States
```typescript
// UI Component
<Button
  onClick={onStartRecording}
  disabled={isRecordingStarting}
>
  {isRecordingStarting ? <Spinner /> : 'Start Recording'}
</Button>

// Orchestration Hook
const [isRecordingStarting, setIsRecordingStarting] = useState(false);

const startRecording = useCallback(async () => {
  setIsRecordingStarting(true);
  try {
    await videoService.startRecording();
    setIsRecording(true);
  } catch (error) {
    handleError(error);
  } finally {
    setIsRecordingStarting(false);
  }
}, [videoService]);
```

### 9.3 Event Callbacks
```typescript
// UI Component
<VideoConferencing
  onParticipantJoined={(participant) => {
    toast.info(`${participant.name} joined the call`);
  }}
  onConnectionQualityChange={(quality) => {
    if (quality === 'poor') {
      showConnectionWarning();
    }
  }}
/>

// Orchestration Hook
useEffect(() => {
  if (prevConnectionQuality !== connectionQuality) {
    onConnectionQualityChange?.(connectionQuality);
  }
}, [connectionQuality, prevConnectionQuality, onConnectionQualityChange]);
```

---

## 10. Integration Guidelines

### 10.1 Migration Path
1. **Phase 1**: Create orchestration hooks with existing logic
2. **Phase 2**: Refactor UI components to use props instead of internal state
3. **Phase 3**: Create container components that connect hooks to UI
4. **Phase 4**: Add tests for hooks and components
5. **Phase 5**: Optimize and add advanced features

### 10.2 Backwards Compatibility
```typescript
// Support both old and new patterns during migration
export function VideoConferencing(props: VideoConferencingProps) {
  // New pattern - receive orchestration from container
  if (props.orchestration) {
    return <VideoConferencingPresenter {...props.orchestration} />;
  }

  // Old pattern - self-contained (deprecated)
  const orchestration = useVideoConferencingOrchestration({
    interviewId: props.interviewId,
    participantInfo: props.participantInfo,
  });

  return <VideoConferencingPresenter {...orchestration} />;
}
```

### 10.3 Feature Flags
```typescript
// Use feature flags for gradual rollout
const orchestration = useVideoConferencingOrchestration({
  interviewId,
  participantInfo,
  settings: {
    enableNewErrorHandling: featureFlags.videoErrorHandlingV2,
    enableConnectionQualityMonitoring: featureFlags.videoQualityMonitoring,
  },
});
```

---

## 11. Advanced Patterns

### 11.1 Composable Hooks
```typescript
// Base connection hook
function useWebRTCConnection(config) {
  // WebRTC connection logic
}

// Composable screen share hook
function useScreenShare(connection) {
  const screenStream = useRef<MediaStream | null>(null);

  const startScreenShare = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({...});
    screenStream.current = stream;
    await connection.replaceVideoTrack(stream.getVideoTracks()[0]);
  }, [connection]);

  return { startScreenShare, screenStream };
}

// Compose in main hook
function useVideoConferencingOrchestration(config) {
  const connection = useWebRTCConnection(config);
  const screenShare = useScreenShare(connection);
  const chat = useVideoChatOrchestration(config);

  return {
    ...connection,
    ...screenShare,
    ...chat,
  };
}
```

### 11.2 Custom Event System
```typescript
// Create event emitter for orchestration hooks
class VideoOrchestrationEvents extends EventEmitter {
  emitSessionUpdate(session: VideoSession) {
    this.emit('session:update', session);
  }

  onSessionUpdate(handler: (session: VideoSession) => void) {
    this.on('session:update', handler);
    return () => this.off('session:update', handler);
  }
}

// Use in hook
const events = useMemo(() => new VideoOrchestrationEvents(), []);

useEffect(() => {
  const cleanup = events.onSessionUpdate((session) => {
    // Handle session update
  });
  return cleanup;
}, [events]);
```

---

## 12. Namespace and Exports

### 12.1 Recommended Structure
```typescript
// apps/web/src/hooks/video/index.ts
export { useVideoConferencingOrchestration } from './useVideoConferencingOrchestration';
export { useVideoChatOrchestration } from './useVideoChatOrchestration';
export { useScreenShareOrchestration } from './useScreenShareOrchestration';
export { useVideoRecording } from './useVideoRecording';
export { useConnectionQuality } from './useConnectionQuality';

export type {
  VideoConferencingOrchestrationConfig,
  VideoConferencingOrchestrationReturn,
  VideoChatOrchestrationConfig,
  VideoChatOrchestrationReturn,
  VideoError,
  ConnectionQuality,
} from './types';
```

### 12.2 Usage in Containers
```typescript
// apps/web/src/containers/video/VideoConferencingContainer.tsx
import {
  useVideoConferencingOrchestration,
  type VideoConferencingOrchestrationConfig,
} from '@/hooks/video';
import { VideoConferencing } from '@workspace/ui/video';

export function VideoConferencingContainer(props: VideoConferencingOrchestrationConfig) {
  const orchestration = useVideoConferencingOrchestration(props);

  return <VideoConferencing {...orchestration} />;
}
```

---

## 13. Memory Coordination

### 13.1 Store Design Decisions
```bash
# Store orchestration architecture in swarm memory
npx claude-flow@alpha hooks post-edit \
  --file "docs/architecture/video-orchestration-hooks.md" \
  --memory-key "hive/phase5/research/orchestration-architecture"
```

### 13.2 Notify Swarm
```bash
# Notify other agents that research is complete
npx claude-flow@alpha hooks notify \
  --message "Video orchestration architecture design complete. Hooks will live in app/src/hooks/video/. UI components remain in packages/ui/src/video/."
```

---

## 14. Summary

### Key Decisions
1. **Orchestration hooks live in app layer** (`apps/web/src/hooks/video/`)
2. **UI components remain presentational** (`packages/ui/src/video/`)
3. **Container pattern** connects hooks to UI components
4. **Strong TypeScript contracts** between layers
5. **Composable hook architecture** for extensibility

### Benefits
- ✅ Better testability (hooks and components tested separately)
- ✅ Reusability (hooks can be used by multiple components)
- ✅ Type safety (explicit prop interfaces)
- ✅ Performance (memoization, lazy loading)
- ✅ Maintainability (clear separation of concerns)

### Next Steps for Coder Agent
1. Implement `useVideoConferencingOrchestration()` hook
2. Implement `useVideoChatOrchestration()` hook
3. Refactor `<VideoConferencing />` to accept props
4. Refactor `<VideoChat />` to accept props
5. Create container components
6. Add comprehensive tests
