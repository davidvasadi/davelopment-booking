import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Világos-mód tokenek KÖZVETLENÜL (nem CSS-változós bg-background/text-foreground),
          // mert azok a .dark ősosztály alatt (rendszer sötét-mód) elsötétülnének, miközben a
          // körülöttük lévő panel (pl. BookingEditSheet) mindig fehér marad — láthatatlan szöveg.
          "flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
