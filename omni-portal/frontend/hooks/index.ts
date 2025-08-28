/**
 * Central export point for all hooks
 * Provides the integrated versions that work with new architecture
 */

// Auth - CONSOLIDATED IMPLEMENTATION
// Single source of truth for all authentication
export { useAuth } from './auth/useAuth';
export { useAuthWithCleanup, useAuthWithVerification } from './useAuth';

// Legacy auth exports (deprecated)
export { useAuthImplementation, useAuthMetrics } from './useAuthIntegration';

// Gamification - use integrated version
export { useGamificationIntegrated as useGamification } from './useGamificationIntegration';
export { useGamificationIntegrated as useGamificationIntegration } from './useGamificationIntegration';

// State Management - new unified hooks
export {
  useUnifiedState,
  useUnifiedDomain,
  useAuthState,
  useUIState,
  useSessionState,
  useUserPreferences,
  useHealthState,
  useGamificationState
} from '@/modules/state/hooks/useUnifiedState';

// Event Bus - new event-driven hooks
export {
  useEventListener,
  useEventEmitter,
  useEventRequest,
  useAuthEvents,
  useNavigationEvents,
  useHealthEvents,
  useApiEvents,
  useUIEvents,
  useErrorEvents,
  usePerformanceEvents,
  useEventDrivenFlow,
  useEventDebugger
} from '@/modules/events/hooks/useEventBus';

// API Gateway - new unified API hooks
export {
  useApiRequest,
  usePaginatedApi,
  useCrudApi,
  useApiSubscription,
  useFileUpload
} from '@/modules/api/hooks/useApiGateway';

// Profile - new modular profile hooks
export { useProfile, useProfileDisplay } from '@/modules/profile/useProfile';

// Legacy hooks (kept for backward compatibility)
export { useLGPD } from './useLGPD';
export { useRewards } from './useRewards';
export { useRegistration } from './useRegistration';
export { useHealthSessionPersistence } from './useHealthSessionPersistence';
export { useAdminPermissions } from './useAdminPermissions';
export { useAdminUsers } from './useAdminUsers';
export { useApi } from './useApi';
export { useApiHealth } from './useApiHealth';
export { useAsyncSafeState } from './useAsyncSafeState';
export { useStableCallback } from './useStableCallback';
export { usePDFGeneration } from './usePDFGeneration';
export { useUnifiedNavigation } from './useUnifiedNavigation';
export { useGamificationTracking } from './useGamificationTracking';

// Re-export types
export type { Profile, ProfileMetrics } from '@/modules/profile/ProfileService';
export type { Event, EventPayload, EventPriority } from '@/modules/events/EventBus';
export type { ApiRequest, ApiResponse, ApiOperation } from '@/modules/api/ApiGateway';
export type { StateDomain } from '@/modules/state/UnifiedStateAdapter';