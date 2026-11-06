import * as React from "react"

import { cn } from "@/lib/utils"
import { FIELD } from "@/components/ui-kit"

/** A kit többsoros mezője (FIELD) — forwardRef-fel a régi űrlapoknak. */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return <textarea className={cn(FIELD, "min-h-[96px] resize-none py-3 leading-relaxed", className)} ref={ref} {...props} />
})
Textarea.displayName = "Textarea"

export { Textarea }
