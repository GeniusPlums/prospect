import { Copy, Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  classifyCallToolError,
  isLoginRequired,
  redirectToLoginIfRequired,
} from "@/lib/app-data";
import { sendOutreachEmail } from "@/lib/mail/send-outreach";
import { draftOutreach, draftOutreachSubject, syntheticEmail } from "@/lib/ranking";
import { useProspectStore } from "@/lib/store";
import type { Candidate, OutreachVia, SearchRun } from "@/lib/types";

function mailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function viaLabel(via?: OutreachVia): string {
  if (via === "outlook") return "Outlook";
  if (via === "mail-app") return "mail app";
  return "Gmail";
}

export function OutreachComposer({
  run,
  candidate,
  revealed,
}: {
  run: SearchRun;
  candidate: Candidate;
  revealed: boolean;
}) {
  const setOutreach = useProspectStore((s) => s.setOutreach);
  const markSent = useProspectStore((s) => s.markSent);
  const sent = run.sent?.[candidate.id];
  const storedBody = run.outreach[candidate.id];

  const [to, setTo] = useState(syntheticEmail(candidate));
  const [subject, setSubject] = useState(draftOutreachSubject(candidate, run.icp));
  const [body, setBody] = useState(storedBody ?? draftOutreach(candidate, run.icp));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setTo(syntheticEmail(candidate));
    setSubject(draftOutreachSubject(candidate, run.icp));
    setBody(run.outreach[candidate.id] ?? draftOutreach(candidate, run.icp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id, run.id]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function onSendInbox() {
    if (!revealed) {
      toast.error("Reveal contact first.");
      return;
    }
    setOutreach(run.id, candidate.id, body);
    setSending(true);
    try {
      const result = await sendOutreachEmail({ data: { to, subject, body } });
      if (result.ok) {
        markSent(run.id, candidate.id, { to, subject, at: Date.now(), via: result.via });
        toast.success(`Sent from ${viaLabel(result.via)} to ${to}`);
        return;
      }
      const toolResult = {
        ok: false as const,
        data: null,
        errorMessage: result.error,
        loginRequired: result.loginRequired,
        loginUrl: result.loginUrl,
      };
      if (isLoginRequired(toolResult) && redirectToLoginIfRequired(toolResult)) {
        toast.message("Connect Gmail or Outlook, then send again.");
        return;
      }
      const classified = classifyCallToolError(toolResult);
      if (classified?.kind === "not_connected" || classified?.kind === "login") {
        toast.error("Connect Gmail or Outlook in Grok to send from your inbox.");
        return;
      }
      toast.error(classified?.message ?? result.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  function onMailApp() {
    if (!revealed) {
      toast.error("Reveal contact first.");
      return;
    }
    setOutreach(run.id, candidate.id, body);
    window.location.href = mailtoHref(to, subject, body);
  }

  return (
    <div id="outreach" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Drafted from this dossier — vintage, public work, and the brief. Edit anything before it
          leaves.
        </p>
        {sent ? (
          <p className="text-xs text-for">
            Sent from {viaLabel(sent.via)}{" "}
            {new Date(sent.at).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            to {sent.to}
          </p>
        ) : null}
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">To</span>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            type="email"
            autoComplete="off"
            disabled={!revealed}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Subject</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Note</span>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-40"
          />
        </label>
      </div>
      <div className="border-t border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void onSendInbox()} disabled={sending || !revealed}>
            <Send />
            {sending ? "Sending…" : sent ? "Send again" : "Send from inbox"}
          </Button>
          <Button variant="outline" onClick={onMailApp} disabled={!revealed}>
            <Mail />
            Open in mail app
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void copy(body)}>
            <Copy />
            Copy
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Sends through Gmail or Outlook if you have one connected in Grok.
        </p>
      </div>
    </div>
  );
}
