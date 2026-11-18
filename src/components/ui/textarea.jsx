import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(/** @param {React.ComponentPropsWithoutRef<'textarea'>} props @param {React.ForwardedRef<HTMLTextAreaElement>} ref */ ({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-2xl border border-input bg-card/50 px-4 py-3 text-base shadow-elev-1 transition-all duration-300 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
