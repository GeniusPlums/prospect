import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 font-ui text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary text-muted-foreground",
        strong: "bg-for/15 text-for",
        mixed: "bg-unclear/15 text-unclear",
        weak: "bg-secondary text-muted-foreground",
        flagged: "bg-destructive/15 text-destructive",
        for: "bg-for/15 text-for",
        against: "bg-against/15 text-against",
        unclear: "bg-unclear/15 text-unclear",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
