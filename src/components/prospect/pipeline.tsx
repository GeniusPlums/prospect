import { FlowSteps } from "@/components/prospect/steps";
import { cn } from "@/lib/utils";

export function PipelineRun({
  events,
}: {
  events: { step: string; message: string }[];
}) {
  const toolkit = events
    .map((event) => event.message.match(/^Finding via (.+)$/)?.[1])
    .find(Boolean);
  const cache = events.find((event) => event.step === "cache");
  const collect = events.find((event) => event.step === "collect");
  const spend = events.find((event) => event.step === "spend");
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <FlowSteps current={3} />
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl tracking-tight">Finding</h1>
        {toolkit ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs">{toolkit}</span>
        ) : null}
      </div>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Named toolkit. Cache first, collect on miss, spend visible. Contact stays hidden until you ask.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Cache</p>
          <p className="font-medium">{cache ? cache.message.replace("Cache check · ", "") : "…"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Collect</p>
          <p className="font-medium">{collect?.message ?? "…"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Spend this run</p>
          <p className="font-medium">{spend?.message.replace("Spend this run · ", "") ?? "0 profiles charged"}</p>
        </div>
      </div>
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
