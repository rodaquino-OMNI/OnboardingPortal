/**
 * Minimal Profile Form Component
 * Sprint 2C - Registration Pages
 *
 * Pure presentation component for minimal profile completion
 * ADR-003 Compliance: Components only render, pages orchestrate
 */
export interface MinimalProfileData {
    fullName: string;
    dateOfBirth: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
}
export interface MinimalProfileFormProps {
    onSubmit: (data: MinimalProfileData) => void;
    isLoading?: boolean;
    error?: string | null;
    initialData?: Partial<MinimalProfileData>;
}
/**
 * Minimal profile form presentation component
 * Collects essential user information after email verification
 */
export declare function MinimalProfileForm({ onSubmit, isLoading, error, initialData }: MinimalProfileFormProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=MinimalProfileForm.d.ts.map