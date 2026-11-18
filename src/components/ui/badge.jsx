import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-xl border px-3 py-1 text-xs font-bold tracking-tight transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-elev-1",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-elev-2 hover:shadow-elev-3 hover:-translate-y-0.5",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground shadow-elev-1 hover:bg-secondary/80 hover:-translate-y-0.5",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-elev-2 hover:bg-destructive/80 hover:-translate-y-0.5",
        outline: "border-border text-foreground hover:bg-muted hover:-translate-y-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
