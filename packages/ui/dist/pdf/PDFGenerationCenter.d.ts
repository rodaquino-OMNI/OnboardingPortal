import { UserProfile } from '@/lib/pdf-generation';
import { HealthAssessmentResults } from '@/lib/unified-health-flow';
interface PDFGenerationCenterProps {
    user: UserProfile;
    healthResults: HealthAssessmentResults;
    onComplete?: () => void;
    showImmediately?: boolean;
}
export declare function PDFGenerationCenter({ user, healthResults, onComplete, showImmediately }: PDFGenerationCenterProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=PDFGenerationCenter.d.ts.map