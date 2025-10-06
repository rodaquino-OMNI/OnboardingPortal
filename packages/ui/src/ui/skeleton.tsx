import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-gray-200 to-gray-300",
        "relative overflow-hidden",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        "before:animate-[shimmer_2s_infinite]",
        className
      )}
      {...props}
    />
  )
}

// Skeleton variants for common UI patterns
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card-modern p-6 space-y-4", className)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-4" 
          style={{ width: `${100 - (i * 15)}%` }}
        />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return <Skeleton className={cn("h-12 w-12 rounded-full", className)} />
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-24 rounded-lg", className)} />
}

export { Skeleton }