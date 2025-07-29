import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Info 
} from "lucide-react"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 shadow-sm transition-all duration-200 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground animate-fade-in",
  {
    variants: {
      variant: {
        default: "bg-white text-gray-950 border-gray-200 hover:shadow-md",
        success: "border-green-200 bg-gradient-to-r from-green-50 to-green-100 text-green-900 [&>svg]:text-green-600",
        error: "border-red-200 bg-gradient-to-r from-red-50 to-red-100 text-red-900 [&>svg]:text-red-600",
        warning: "border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-900 [&>svg]:text-yellow-600",
        info: "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-900 [&>svg]:text-blue-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  default: null,
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, children, ...props }, ref) => {
  const Icon = iconMap[variant || "default"]
  
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
      {children}
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }