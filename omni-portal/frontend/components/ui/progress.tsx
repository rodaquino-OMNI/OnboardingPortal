import * as React from "react"
import { cn } from "@/lib/utils"

// Linear Progress Bar
const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: number
    max?: number
    showLabel?: boolean
  }
>(({ className, value = 0, max = 100, showLabel = false, ...props }, ref) => {
  const percentage = Math.round((value / max) * 100)

  return (
    <div
      ref={ref}
      className={cn("relative w-full", className)}
      data-testid="progress-bar"
      {...props}
    >
      <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
        <div
          style={{ width: `${percentage}%` }}
          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`Progress: ${percentage}% complete`}
        />
      </div>
      {showLabel && (
        <span className="text-sm text-gray-600 mt-1 block text-center">
          {percentage}%
        </span>
      )}
    </div>
  )
})
Progress.displayName = "Progress"

// Circular Progress
const CircularProgress = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & {
    value?: number
    max?: number
    size?: number
    strokeWidth?: number
    showLabel?: boolean
  }
>(({ 
  className, 
  value = 0, 
  max = 100, 
  size = 64, 
  strokeWidth = 4,
  showLabel = false,
  ...props 
}, ref) => {
  const percentage = Math.round((value / max) * 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn("relative inline-flex", className)}>
      <svg
        ref={ref}
        width={size}
        height={size}
        className="transform -rotate-90"
        {...props}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-blue-600 transition-all duration-300"
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold">{percentage}%</span>
        </div>
      )}
    </div>
  )
})
CircularProgress.displayName = "CircularProgress"

export { Progress, CircularProgress }