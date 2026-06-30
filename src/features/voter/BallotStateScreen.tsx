import { CheckCircle2, Clock, Link2Off, Vote } from "lucide-react";

type Screen = "thanks" | "already_voted" | "closed" | "invalid";

const SCREENS: Record<
  Screen,
  { icon: React.ReactNode; title: string; body: string; accent?: boolean }
> = {
  thanks: {
    icon: <CheckCircle2 className="size-7 text-success" />,
    title: "Thank you",
    body:
      "Your response has been recorded. We’re keeping results under wraps so they don’t sway anyone else — no peeking at the tally, by design.",
    accent: true,
  },
  already_voted: {
    icon: <Vote className="size-7 text-muted-foreground" />,
    title: "You’ve already voted",
    body: "This link has been used. Each link works once — thanks for taking part.",
  },
  closed: {
    icon: <Clock className="size-7 text-muted-foreground" />,
    title: "This test has closed",
    body: "Voting is no longer open for this design test. Thanks for stopping by.",
  },
  invalid: {
    icon: <Link2Off className="size-7 text-muted-foreground" />,
    title: "This link isn’t valid",
    body:
      "The link may be mistyped or expired. Check that you used the full link from your invitation.",
  },
};

export function BallotStateScreen({ state }: { state: Screen }) {
  const s = SCREENS[state];
  return (
    <div className="screen-glow flex min-h-[72vh] items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl border border-border/70 bg-card shadow-card">
          {s.icon}
        </div>
        <h1 className="font-sans font-bold text-[1.7rem] tracking-tight">{s.title}</h1>
        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-muted-foreground">{s.body}</p>
      </div>
    </div>
  );
}
