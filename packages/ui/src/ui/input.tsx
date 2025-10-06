import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  mask?: "cpf" | "phone" | "date" | "cep"
  icon?: LucideIcon
  error?: string | undefined
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, mask, onChange, icon: Icon, error, ...props }, ref) => {
    const formatValue = (value: string, maskType?: string) => {
      if (!maskType || !value) return value

      // Remove non-numeric characters
      const numbers = value.replace(/\D/g, "")

      switch (maskType) {
        case "cpf":
          // Format: 000.000.000-00
          return numbers
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d{1,2})/, "$1-$2")
            .replace(/(-\d{2})\d+?$/, "$1")

        case "phone":
          // Format: (00) 00000-0000 or (00) 0000-0000
          if (numbers.length <= 10) {
            return numbers
              .replace(/(\d{2})(\d)/, "($1) $2")
              .replace(/(\d{4})(\d)/, "$1-$2")
              .replace(/(-\d{4})\d+?$/, "$1")
          } else {
            return numbers
              .replace(/(\d{2})(\d)/, "($1) $2")
              .replace(/(\d{5})(\d)/, "$1-$2")
              .replace(/(-\d{4})\d+?$/, "$1")
          }

        case "date":
          // Format: 00/00/0000
          return numbers
            .replace(/(\d{2})(\d)/, "$1/$2")
            .replace(/(\d{2})(\d)/, "$1/$2")
            .replace(/(\d{4})\d+?$/, "$1")

        case "cep":
          // Format: 00000-000
          return numbers
            .replace(/(\d{5})(\d)/, "$1-$2")
            .replace(/(-\d{3})\d+?$/, "$1")

        default:
          return value
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (mask) {
        e.target.value = formatValue(e.target.value, mask)
      }
      onChange?.(e)
    }

    return (
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-lg border bg-white px-3 py-2 text-sm",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200",
            "hover:border-gray-400",
            Icon && "pl-10",
            error && "border-red-500 focus:ring-red-500",
            !error && "border-gray-200",
            className
          )}
          ref={ref}
          onChange={handleChange}
          {...props}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }