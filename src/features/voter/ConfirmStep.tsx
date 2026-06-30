import { useState } from "react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import type { BallotVariant, CastVoteCode } from "@/lib/types";
import { castVote } from "@/lib/ballotApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/Spinner";
import { BallotStateScreen } from "./BallotStateScreen";

// Deliberate confirm step so a misclick isn't a final vote (§10). Optional rationale.
export function ConfirmStep({
  token,
  chosen,
  noPref,
  collectRationale,
  onBack,
  onDone,
}: {
  token: string;
  chosen: BallotVariant | null;
  noPref: boolean;
  collectRationale: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [terminal, setTerminal] = useState<CastVoteCode | null>(null);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await castVote({
        token,
        variant_id: noPref ? null : chosen?.id ?? null,
        no_preference: noPref,
        rationale: rationale.trim() || null,
      });
      if (res.status === "ok") {
        onDone();
      } else {
        // already_voted / test_closed are terminal states — show the matching screen.
        if (res.code === "already_voted") setTerminal("already_voted");
        else if (res.code === "test_closed") setTerminal("test_closed");
        else setTerminal(res.code ?? "server_error");
      }
    } catch {
      setTerminal("server_error");
    } finally {
      setSubmitting(false);
    }
  }

  if (terminal === "already_voted") return <BallotStateScreen state="already_voted" />;
  if (terminal === "test_closed") return <BallotStateScreen state="closed" />;

  return (
    <div className="mx-auto max-w-md animate-fade-in">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Change my choice
      </button>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-accent">
          <ShieldCheck className="size-5" />
          <p className="text-sm font-medium">Confirm your vote</p>
        </div>

        {noPref ? (
          <p className="mt-4 font-sans font-bold text-2xl tracking-tight">No clear preference</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">You’re choosing this design:</p>
            {chosen?.url && (
              <img
                src={chosen.url}
                alt="Your chosen design"
                className="mt-3 aspect-[4/3] w-full rounded-lg border border-border object-contain"
              />
            )}
            {chosen?.caption && (
              <p className="mt-2 text-sm text-muted-foreground">{chosen.caption}</p>
            )}
          </>
        )}

        {collectRationale && (
          <div className="mt-5 space-y-2">
            <Label htmlFor="rationale">Why? (optional)</Label>
            <Textarea
              id="rationale"
              value={rationale}
              maxLength={1000}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="A sentence on what tipped it for you."
            />
          </div>
        )}

        {terminal && (
          <p className="mt-4 text-sm text-destructive">
            {terminal === "invalid_choice"
              ? "That choice isn’t valid for this test."
              : "Something went wrong submitting your vote. Please try again."}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" onClick={submit} disabled={submitting}>
            {submitting && <Spinner />}
            Submit vote
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            This is final — you can vote once with your link.
          </p>
        </div>
      </div>
    </div>
  );
}
