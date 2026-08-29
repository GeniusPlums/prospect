import { X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { Icp } from "@/lib/types";
import { cn } from "@/lib/utils";

function ChipList({
  items,
  onRemove,
  onAdd,
  placeholder,
  tone = "default",
}: {
  items: string[];
  onRemove: (value: string) => void;
  onAdd: (value: string) => void;
  placeholder: string;
  tone?: "default" | "for" | "against";
}) {
  const [draft, setDraft] = useState("");
  const toneClass =
    tone === "for"
      ? "border-for/30 text-for"
      : tone === "against"
        ? "border-against/30 text-against"
        : "border-border text-foreground";

  function commit() {
    const value = draft.trim();
    if (!value) return;
    onAdd(value);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          title="Remove"
          onClick={() => onRemove(item)}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors duration-150 hover:bg-accent",
            toneClass,
          )}
        >
          {item}
          <X className="size-3 opacity-60" />
        </button>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        className="h-9 min-w-40 flex-1 rounded-full border-dashed bg-transparent"
      />
    </div>
  );
}

export function IcpEditor({
  icp,
  onChange,
}: {
  icp: Icp;
  onChange: (icp: Icp) => void;
}) {
  const setList = (key: "must" | "nice" | "disqualifiers", next: string[]) =>
    onChange({ ...icp, [key]: next });

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-display text-3xl tracking-tight text-balance">{icp.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{icp.summary}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Tap a tag to drop it. Add your own, then find people.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.14em] text-for">Must have</h3>
          <p className="text-xs text-muted-foreground">They need this, or they’re out.</p>
          <ChipList
            items={icp.must}
            tone="for"
            placeholder="Add a must, press return"
            onRemove={(v) => setList("must", icp.must.filter((x) => x !== v))}
            onAdd={(v) => setList("must", [...icp.must, v])}
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.14em] text-unclear">Nice to have</h3>
          <p className="text-xs text-muted-foreground">A plus — not a hard filter.</p>
          <ChipList
            items={icp.nice}
            placeholder="Add a nice-to-have"
            onRemove={(v) => setList("nice", icp.nice.filter((x) => x !== v))}
            onAdd={(v) => setList("nice", [...icp.nice, v])}
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.14em] text-against">Not a fit</h3>
          <p className="text-xs text-muted-foreground">We’ll flag or drop these.</p>
          <ChipList
            items={icp.disqualifiers}
            tone="against"
            placeholder="Add a disqualifier"
            onRemove={(v) =>
              setList(
                "disqualifiers",
                icp.disqualifiers.filter((x) => x !== v),
              )
            }
            onAdd={(v) => setList("disqualifiers", [...icp.disqualifiers, v])}
          />
        </div>
      </div>

      <dl className="flex flex-wrap gap-2">
        <Constraint label="Years" value={`${icp.yearsMin}–${icp.yearsMax}`} />
        <Constraint label="Where" value={icp.locations.join(" · ") || "Any"} />
        <Constraint label="Level" value={icp.seniority} />
        {icp.skills.slice(0, 4).map((skill) => (
          <Constraint key={skill} label="Skill" value={skill} />
        ))}
      </dl>
    </section>
  );
}

function Constraint({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs capitalize">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
