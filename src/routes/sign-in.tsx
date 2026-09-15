import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/sign-in")({ component: SignInPage });

function SignInPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
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
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-md space-y-6 px-4 py-16">
        <h1 className="font-display text-3xl">{mode === "up" ? "Create workspace" : "Sign in"}</h1>
        <p className="text-sm text-muted-foreground">
          Email and password on this app. Connections (Greenhouse, Apollo, Gmail) are per workspace via Composio.
        </p>
        <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
          {mode === "up" ? (
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          ) : null}
          <Input
            type="email"
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "up" ? "in" : "up")}
        >
          {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        <p className="text-xs text-muted-foreground">
          <Link to="/">Back to source</Link>
        </p>
      </main>
    </AppShell>
  );
}
