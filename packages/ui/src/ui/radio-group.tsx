import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  name: string;
}>({ name: '' });

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const name = React.useId();
    
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
        <div
          ref={ref}
          className={cn("grid gap-2", className)}
          role="radiogroup"
          {...props}
        />
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    
    return (
      <input
        ref={ref}
        type="radio"
        name={context.name}
        value={value}
        checked={context.value === value}
        onChange={() => context.onValueChange?.(value)}
        className={cn(
          "h-4 w-4 rounded-full border border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2",
          className
        )}
        {...props}
      />
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }