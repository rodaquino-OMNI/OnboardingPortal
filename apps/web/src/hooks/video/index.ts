/**
 * Video Orchestration Hooks
 *
 * Export all video orchestration hooks and types for use in app layer.
 * These hooks manage business logic, WebRTC connections, and state management
 * for video conferencing features.
 */

export { useVideoConferencingOrchestration } from './useVideoConferencingOrchestration';
export type {
  VideoConferencingOrchestrationConfig,
  VideoConferencingOrchestrationReturn,
} from './useVideoConferencingOrchestration';

export { useVideoChatOrchestration } from './useVideoChatOrchestration';
export type {
  VideoChatOrchestrationConfig,
  VideoChatOrchestrationReturn,
} from './useVideoChatOrchestration';

export { useScreenShareOrchestration } from './useScreenShareOrchestration';
export type {
  ScreenShareOrchestrationConfig,
  ScreenShareOrchestrationReturn,
} from './useScreenShareOrchestration';

export type {
  VideoError,
  VideoErrorType,
  Participant,
  VideoSession,
  SessionEndData,
  ConnectionStats,
  ConnectionQuality,
  ChatMessage,
  MessageType,
  DataChannelState,
} from './types';
