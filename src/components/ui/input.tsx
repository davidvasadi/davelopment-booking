import * as React from "react"

import { cn } from "@/lib/utils"
import { FIELD } from "@/components/ui-kit"

/** A kit mezője (FIELD: cella-háttér, 14px lekerekítés, 44px) — forwardRef-fel a régi űrlapoknak (react-hook-form). */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return <input type={type} className={cn(FIELD, "h-11", className)} ref={ref} {...props} />
  }
)
Input.displayName = "Input"

export { Input }
