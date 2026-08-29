import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-11 w-full items-center gap-1 border-b border-border px-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative inline-flex h-11 min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors duration-150",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "data-[state=active]:text-foreground",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-transparent after:transition-colors",
        "data-[state=active]:after:bg-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "min-h-0 flex-1 focus-visible:outline-none data-[state=inactive]:hidden",
        className,
      )}
      {...props}
    />
  );
}
