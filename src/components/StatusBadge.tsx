import { Badge } from "@/components/ui/badge";
import type { TestStatus } from "@/lib/types";

const MAP: Record<TestStatus, { label: string; variant: "muted" | "success" | "outline" }> = {
  draft: { label: "Draft", variant: "muted" },
  active: { label: "Active", variant: "success" },
  closed: { label: "Closed", variant: "outline" },
};

export function StatusBadge({ status }: { status: TestStatus }) {
  const { label, variant } = MAP[status];
  return (
    <Badge variant={variant}>
      {status === "active" && <span className="size-1.5 rounded-full bg-success" />}
      {label}
    </Badge>
  );
}
