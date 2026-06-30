import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner, FullPageSpinner } from "@/components/Spinner";

export function LoginPage() {
  const { loading, isAdmin } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") || "/admin";
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <FullPageSpinner />;
  if (isAdmin) return <Navigate to={next} replace />;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const redirectTo = `${window.location.origin}${next.startsWith("/") ? next : "/admin"}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="screen-glow flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground font-serif text-xl shadow-card">
            D
          </span>
          <h1 className="font-serif text-3xl tracking-tight">Design Face-Off</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Admin sign-in · access is invite-only
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border/70 bg-card p-7 text-center shadow-lift animate-scale-in">
            <Mail className="mx-auto mb-3 size-6 text-accent" />
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a magic link to <span className="text-foreground">{email}</span>. Open it on
              this device to continue.
            </p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="space-y-4 rounded-xl border border-border/70 bg-card p-7 shadow-lift">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={sending || !email}>
              {sending && <Spinner />}
              Send magic link
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Only seeded admins can access the dashboard. Signing in with an unlisted email won’t
              grant access.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
