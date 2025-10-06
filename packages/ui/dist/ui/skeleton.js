import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
function Skeleton({ className, ...props }) {
    return (_jsx("div", { className: cn("animate-pulse rounded-lg bg-gradient-to-r from-gray-200 to-gray-300", "relative overflow-hidden", "before:absolute before:inset-0 before:-translate-x-full", "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent", "before:animate-[shimmer_2s_infinite]", className), ...props }));
}
// Skeleton variants for common UI patterns
export function SkeletonCard({ className }) {
    return (_jsxs("div", { className: cn("card-modern p-6 space-y-4", className), children: [_jsx(Skeleton, { className: "h-4 w-3/4" }), _jsx(Skeleton, { className: "h-3 w-full" }), _jsx(Skeleton, { className: "h-3 w-5/6" }), _jsxs("div", { className: "flex gap-2 mt-4", children: [_jsx(Skeleton, { className: "h-8 w-20 rounded-md" }), _jsx(Skeleton, { className: "h-8 w-20 rounded-md" })] })] }));
}
export function SkeletonText({ lines = 3, className }) {
    return (_jsx("div", { className: cn("space-y-2", className), children: Array.from({ length: lines }).map((_, i) => (_jsx(Skeleton, { className: "h-4", style: { width: `${100 - (i * 15)}%` } }, i))) }));
}
export function SkeletonAvatar({ className }) {
    return _jsx(Skeleton, { className: cn("h-12 w-12 rounded-full", className) });
}
export function SkeletonButton({ className }) {
    return _jsx(Skeleton, { className: cn("h-10 w-24 rounded-lg", className) });
}
export { Skeleton };
