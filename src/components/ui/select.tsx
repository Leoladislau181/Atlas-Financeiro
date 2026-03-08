import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/50 focus-visible:border-[#F59E0B] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 hover:border-gray-300",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Select.displayName = "Select"

export { Select }
