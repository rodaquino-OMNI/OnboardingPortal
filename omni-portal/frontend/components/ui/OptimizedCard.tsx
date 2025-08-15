import * as React from "react"
import { cn } from "@/lib/utils"

// PERFORMANCE OPTIMIZATION: Memoize card classes to prevent recalculation
const cardClasses = "rounded-lg border bg-card text-card-foreground shadow-sm"
const cardHeaderClasses = "flex flex-col space-y-1.5 p-6"
const cardTitleClasses = "text-2xl font-semibold leading-none tracking-tight"
const cardDescriptionClasses = "text-sm text-muted-foreground"
const cardContentClasses = "p-6 pt-0"
const cardFooterClasses = "flex items-center p-6 pt-0"

// PERFORMANCE OPTIMIZATION: Memoize Card component
const Card = React.memo(React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardClasses, className)}
    {...props}
  />
)))
Card.displayName = "Card"

// PERFORMANCE OPTIMIZATION: Memoize CardHeader component
const CardHeader = React.memo(React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(cardHeaderClasses, className)} {...props} />
)))
CardHeader.displayName = "CardHeader"

// PERFORMANCE OPTIMIZATION: Memoize CardTitle component
const CardTitle = React.memo(React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(cardTitleClasses, className)}
    {...props}
  />
)))
CardTitle.displayName = "CardTitle"

// PERFORMANCE OPTIMIZATION: Memoize CardDescription component
const CardDescription = React.memo(React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(cardDescriptionClasses, className)}
    {...props}
  />
)))
CardDescription.displayName = "CardDescription"

// PERFORMANCE OPTIMIZATION: Memoize CardContent component
const CardContent = React.memo(React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(cardContentClasses, className)} {...props} />
)))
CardContent.displayName = "CardContent"

// PERFORMANCE OPTIMIZATION: Memoize CardFooter component
const CardFooter = React.memo(React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(cardFooterClasses, className)} {...props} />
)))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }