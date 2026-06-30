import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, BarChart3, ArrowUpRight } from "lucide-react";
import { fetchOverview, type TestOverview } from "./api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { LeaningBadge } from "@/components/LeaningBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { classifyLeaning } from "@/lib/config";
import { formatDate, pct } from "@/lib/utils";

function leaningFor(t: TestOverview) {
  // For exactly 2 variants the runner-up tally is decisive_n - top_count.
  const second = t.decisive_n - t.top_count;
  const marginPts = t.decisive_n ? Math.round(((t.top_count - second) / t.decisive_n) * 100) : 0;
  return classifyLeaning(marginPts, t.decisive_n);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: fetchOverview });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Tests</h1>
          <p className="mt-1.5 text-muted-foreground">
            Preference tests you own. Results are directional signal — not conversion claims.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link to="/admin/tests/new">
            <Plus className="size-4" />
            New test
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invited</TableHead>
                <TableHead className="text-right">Voted</TableHead>
                <TableHead className="text-right">Completion</TableHead>
                <TableHead>Leaning</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => {
                const completion = pct(t.voted_count, t.invited_count);
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/tests/${t.id}`)}
                  >
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.invited_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.voted_count}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {completion}%
                    </TableCell>
                    <TableCell>
                      <LeaningBadge leaning={leaningFor(t)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link to={`/admin/tests/${t.id}/results`}>
                            <BarChart3 className="size-4" />
                            Results
                          </Link>
                        </Button>
                        <ArrowUpRight className="size-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 border-dashed py-20 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-secondary">
        <BarChart3 className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">No tests yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first preference test, upload two designs, and invite a panel.
        </p>
      </div>
      <Button asChild variant="accent">
        <Link to="/admin/tests/new">
          <Plus className="size-4" />
          New test
        </Link>
      </Button>
    </Card>
  );
}
