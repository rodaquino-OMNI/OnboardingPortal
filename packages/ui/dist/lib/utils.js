import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
/**
 * Merge Tailwind CSS classes with proper precedence
 * @param inputs - Class names to merge
 * @returns Merged class string
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
