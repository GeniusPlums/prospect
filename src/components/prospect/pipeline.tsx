import { FlowSteps } from "@/components/prospect/steps";
import { cn } from "@/lib/utils";

export function PipelineRun({
  events,
}: {
  events: { step: string; message: string }[];
}) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <FlowSteps current={3} />
      <h1 className="mt-6 font-display text-3xl tracking-tight">Finding people…</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Cache before collect. Contact stays hidden until you ask.
      </p>
      <ol className="mt-8 space-y-2.5 font-mono text-sm">
        {events.map((event, i) => (
          <li key={`${event.step}-${i}`} className={cn("text-foreground")}>
            {event.message}
          </li>
        ))}
      </ol>
    </div>
  );
}
