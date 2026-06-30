import { Badge } from "@/components/ui/badge";
import type { Leaning } from "@/lib/config";

const VARIANT: Record<Leaning, "muted" | "outline" | "accent" | "success"> = {
  Inconclusive: "muted",
  Leaning: "outline",
  Clear: "accent",
  Decisive: "success",
};

export function LeaningBadge({ leaning }: { leaning: Leaning }) {
  return <Badge variant={VARIANT[leaning]}>{leaning}</Badge>;
}
