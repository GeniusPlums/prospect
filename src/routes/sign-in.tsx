import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { DeskStrip } from "@/components/desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { mode?: "in" | "up" } => ({
    mode: search.mode === "up" || search.mode === "in" ? search.mode : undefined,
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const { mode: modeFromUrl } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">(modeFromUrl ?? "in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({ name: name || email.split("@")[0]!, email, password })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Could not sign in");
        return;
      }
      await navigate({ to: mode === "up" ? "/connections" : "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      folio
      action={
        <Link to="/" className="font-ui underline underline-offset-4">
          Back
        </Link>
      }
    >
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-14 sm:grid-cols-[1fr_1fr] sm:px-6">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">
            {mode === "up" ? "Open a workspace" : "Return to the desk"}
          </h1>
          <p className="mt-4 max-w-sm font-sans text-lg leading-snug">
            Email lives here. Hiring tools come next, on Connections. Search is not unlocked on this page.
          </p>
        </div>
        <form className="space-y-4 border border-border bg-card p-6" onSubmit={(event) => void onSubmit(event)}>
          {mode === "up" ? (
            <label className="block font-ui text-sm">
              Name
              <Input
                className="mt-1"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          ) : null}
          <label className="block font-ui text-sm">
            Work email
            <Input
              className="mt-1"
              type="email"
              placeholder="you@studio.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block font-ui text-sm">
            Password
            <Input
              className="mt-1"
              type="password"
              placeholder="8+ characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>
          {error ? <p className="font-ui text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="font-ui text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => setMode(mode === "up" ? "in" : "up")}
          >
            {mode === "up" ? "Already have an account? Sign in" : "New here? Open a workspace"}
          </button>
        </form>
      </main>
      <footer className="mt-auto bg-blotter">
        <DeskStrip />
      </footer>
    </AppShell>
  );
}
