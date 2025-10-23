import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../lib/utils';
export function QuestionnaireProgress({ currentStep, totalSteps, completionPercentage, stepLabels, }) {
    // Ensure percentage is within valid range
    const clampedPercentage = Math.min(100, Math.max(0, completionPercentage));
    return (_jsxs("div", { className: "w-full", "aria-label": "Questionnaire progress", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsxs("span", { className: "text-sm font-medium text-gray-900", children: ["Step ", currentStep + 1, " of ", totalSteps] }), _jsxs("span", { className: "text-sm text-gray-600", "aria-live": "polite", "aria-atomic": "true", children: [clampedPercentage, "% Complete"] })] }), _jsx("div", { className: "w-full h-2 bg-gray-200 rounded-full overflow-hidden", role: "progressbar", "aria-valuenow": clampedPercentage, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `${clampedPercentage}% complete`, children: _jsx("div", { className: "h-full bg-blue-600 transition-all duration-300 ease-in-out", style: { width: `${clampedPercentage}%` } }) }), stepLabels && stepLabels.length > 0 && (_jsx("nav", { "aria-label": "Progress steps", className: "mt-4", children: _jsx("ol", { className: "flex justify-between", children: stepLabels.map((label, index) => (_jsxs("li", { className: cn('text-xs transition-colors duration-200', index <= currentStep
                            ? 'text-blue-600 font-medium'
                            : 'text-gray-400'), "aria-current": index === currentStep ? 'step' : undefined, children: [_jsx("span", { className: "sr-only", children: index < currentStep ? 'Completed: ' :
                                    index === currentStep ? 'Current: ' :
                                        'Upcoming: ' }), label] }, index))) }) }))] }));
}
QuestionnaireProgress.displayName = 'QuestionnaireProgress';
