import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBallot } from "@/lib/ballotApi";
import type { BallotVariant } from "@/lib/types";
import { FullPageSpinner } from "@/components/Spinner";
import { BallotStateScreen } from "./BallotStateScreen";
import { DesignChoice } from "./DesignChoice";
import { ConfirmStep } from "./ConfirmStep";

type Phase =
  | { kind: "selecting" }
  | { kind: "confirming"; variantId: string | null; noPref: boolean }
  | { kind: "done" };

export function BallotPage() {
  const { token } = useParams();
  const [phase, setPhase] = useState<Phase>({ kind: "selecting" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ballot", token],
    queryFn: () => getBallot(token!),
    enabled: !!token,
    retry: 0,
  });

  if (isLoading) return <FullPageSpinner />;
  if (isError || !data) return <BallotStateScreen state="invalid" />;

  if (phase.kind === "done") return <BallotStateScreen state="thanks" />;

  // Non-open states get dedicated screens. An "open" ballot missing its data is treated
  // as invalid rather than rendering an empty ballot.
  if (data.state !== "open" || !data.test || !data.variants) {
    return <BallotStateScreen state={data.state === "open" ? "invalid" : data.state} />;
  }

  const { test, variants } = data;

  if (phase.kind === "confirming") {
    const chosen = variants.find((v) => v.id === phase.variantId) || null;
    return (
      <ConfirmStep
        token={token!}
        chosen={chosen}
        noPref={phase.noPref}
        collectRationale={test.collect_rationale}
        onBack={() => setPhase({ kind: "selecting" })}
        onDone={() => setPhase({ kind: "done" })}
      />
    );
  }

  return (
    <div className="screen-glow animate-fade-in">
      <header className="mx-auto mb-9 max-w-2xl text-center">
        <p className="eyebrow text-accent">Your pick</p>
        <h1 className="mt-3 font-sans font-bold text-[2rem] leading-[1.1] tracking-tight sm:text-[2.6rem]">
          {test.title}
        </h1>
        {test.description && (
          <p className="mx-auto mt-4 max-w-xl text-[0.975rem] leading-relaxed text-muted-foreground">
            {test.description}
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Take a look at both, then choose the one you prefer.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {variants.map((v: BallotVariant, i) => (
          <DesignChoice
            key={v.id}
            variant={v}
            position={i}
            onChoose={() => setPhase({ kind: "confirming", variantId: v.id, noPref: false })}
          />
        ))}
      </div>

      {!test.forced_choice && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setPhase({ kind: "confirming", variantId: null, noPref: true })}
            className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            I have no clear preference
          </button>
        </div>
      )}
    </div>
  );
}
