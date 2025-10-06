/**
 * UI Components - Pure Presentation Layer
 *
 * All components in this package are PURE presentation components
 * that follow ADR-003 strict boundaries:
 * - NO network calls
 * - NO storage access
 * - NO orchestration logic
 * - ALL data via props
 * - ALL interactions via callbacks
 */

export { RegistrationForm } from './RegistrationForm';
export type { RegistrationFormProps, RegisterData, ValidationErrors as RegisterValidationErrors } from './RegistrationForm';

export { MinimalProfileForm } from './MinimalProfileForm';
export type { MinimalProfileFormProps, ProfileData, ValidationErrors as ProfileValidationErrors } from './MinimalProfileForm';

export { CompletionMessage } from './CompletionMessage';
export type { CompletionMessageProps } from './CompletionMessage';
