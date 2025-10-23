/**
 * CompletionMessage - Pure presentation component
 *
 * ADR-003 Compliance:
 * ✅ NO network calls (fetch/axios)
 * ✅ NO storage (localStorage/sessionStorage/IndexedDB)
 * ✅ NO orchestration logic
 * ✅ ALL data via props
 * ✅ ALL interactions via callbacks
 *
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-003: Component Boundaries
 */
import React from 'react';
export interface CompletionMessageProps {
    /** User's name for personalization */
    userName: string;
    /** Points earned during onboarding */
    pointsEarned: number;
    /** Dashboard URL for navigation */
    dashboardUrl: string;
    /** Optional className for styling */
    className?: string;
}
export declare const CompletionMessage: React.FC<CompletionMessageProps>;
export default CompletionMessage;
//# sourceMappingURL=CompletionMessage.d.ts.map