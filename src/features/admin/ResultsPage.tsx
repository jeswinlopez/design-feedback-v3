import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Download, Info, AlertTriangle, Quote } from "lucide-react";
import { fetchResultsData, fetchTest } from "./api";
import { buildVoteRows, computeResults } from "./results";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeaningBadge } from "@/components/LeaningBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { FullPageSpinner } from "@/components/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv, downloadCsv, formatDate } from "@/lib/utils";

const ACCENT = "hsl(232 46% 48%)";

export function ResultsPage() {
  const { id } = useParams();
  const testQuery = useQuery({ queryKey: ["test", id], queryFn: () => fetchTest(id!), enabled: !!id });
  const dataQuery = useQuery({
    queryKey: ["results", id],
    queryFn: () => fetchResultsData(id!),
    enabled: !!id,
  });

  const test = testQuery.data;
  const summary = useMemo(
    () => (dataQuery.data && test ? computeResults(dataQuery.data, test.randomize_position) : null),
    [dataQuery.data, test],
  );

  if (!test || !dataQuery.data || !summary) return <FullPageSpinner />;

  function exportCsv() {
    const rows = buildVoteRows(dataQuery.data!);
    const csv = toCsv(
      ["segment", "choice_label", "no_preference", "rationale", "shown_first_label", "created_at"],
      rows.map((r) => [r.segment, r.choice_label, r.no_preference, r.rationale, r.shown_first_label, r.created_at]),
    );
    const slug = test!.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "test";
    downloadCsv(`${slug}-votes.csv`, csv);
  }

  const rationales = dataQuery.data.votes
    .filter((v) => v.rationale)
    .map((v) => {
      const seg = dataQuery.data!.voters.find((x) => x.id === v.voter_id)?.segment || "Unsegmented";
      const label = summary!.variants.find((x) => x.id === v.variant_id)?.label;
      return { id: v.id, rationale: v.rationale as string, segment: seg, label, noPref: v.no_preference };
    });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/admin/tests/${id}`}>
            <ArrowLeft className="size-4" /> Back to test
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <StatusBadge status={test.status} />
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div>
        <h1 className="font-serif text-3xl tracking-tight">{test.title}</h1>
        <p className="mt-1.5 text-muted-foreground">
          Stated-preference results — directional signal, not a conversion or significance claim.
        </p>
      </div>

      {summary.totalResponses === 0 ? (
        <Card className="border-dashed py-16 text-center">
          <p className="text-muted-foreground">No votes yet. Results appear as panelists respond.</p>
        </Card>
      ) : (
        <>
          {/* Headline */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Responses" value={String(summary.totalResponses)} sub={`${summary.decisiveVotes} decisive`} />
            <StatCard label="Completion" value={`${summary.completionPct}%`} sub={`${summary.voted} of ${summary.invited} invited`} />
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Leaning</p>
                <div className="mt-2 flex items-center gap-2">
                  <LeaningBadge leaning={summary.leaning} />
                  {summary.leader && (
                    <span className="text-sm text-muted-foreground">
                      {summary.marginPts}pt margin · n={summary.decisiveVotes}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Raw split */}
          <Card>
            <CardHeader>
              <CardTitle>Raw split</CardTitle>
              <CardDescription>Share of all responses{test.forced_choice ? "" : ", including “no clear preference”"}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.variants.map((v) => (
                <SplitBar key={v.id} label={`Variant ${v.label}`} caption={v.caption} count={v.count} pct={v.pctOfAll} />
              ))}
              {!test.forced_choice && (
                <SplitBar label="No clear preference" caption={null} count={summary.noPreferenceCount} pct={summary.noPreferencePct} muted />
              )}
            </CardContent>
          </Card>

          {/* Position-corrected split */}
          <Card>
            <CardHeader>
              <CardTitle>Position-corrected split</CardTitle>
              <CardDescription>
                Win-rate by where each design was shown, then a position-balanced estimate (mean of the two).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!summary.positionRandomized ? (
                <Note icon={<Info className="size-4" />}>
                  Position wasn’t randomized for this test, so a position-balanced estimate isn’t
                  meaningful — every voter saw the same order.
                </Note>
              ) : !summary.positionCorrectable ? (
                <Note icon={<Info className="size-4" />}>
                  Not enough data in both positions yet to compute a balanced estimate.
                </Note>
              ) : (
                <>
                  {summary.positionBias && (
                    <Note icon={<AlertTriangle className="size-4 text-amber-600" />} variant="warning">
                      Position bias detected — the first-shown design was chosen{" "}
                      {Math.round(summary.firstPositionWinRatePct ?? 0)}% of the time. Lean on the
                      balanced estimate below rather than the raw split.
                    </Note>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Variant</TableHead>
                        <TableHead className="text-right">Shown first</TableHead>
                        <TableHead className="text-right">Shown second</TableHead>
                        <TableHead className="text-right">Balanced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.variants.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">Variant {v.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtRate(v.winRateFirstPct)} <span className="text-xs text-muted-foreground">({v.firstShown})</span></TableCell>
                          <TableCell className="text-right tabular-nums">{fmtRate(v.winRateSecondPct)} <span className="text-xs text-muted-foreground">({v.secondShown})</span></TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{fmtRate(v.balancedPct)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>

          {/* Completion over time */}
          <Card>
            <CardHeader>
              <CardTitle>Votes over time</CardTitle>
              <CardDescription>Cumulative responses.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.timeline} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="hsl(32 14% 90%)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(t) => formatDate(t as string)}
                      tick={{ fontSize: 12, fill: "hsl(28 6% 44%)" }}
                      stroke="hsl(32 14% 90%)"
                      minTickGap={40}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(28 6% 44%)" }} stroke="hsl(32 14% 90%)" />
                    <Tooltip
                      labelFormatter={(t) => formatDate(t as string)}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(32 14% 90%)", fontSize: 13 }}
                    />
                    <Line type="monotone" dataKey="cumulative" stroke={ACCENT} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Segment breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>By segment</CardTitle>
              <CardDescription>Split within each panel segment.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Segment</TableHead>
                    {summary.variants.map((v) => (
                      <TableHead key={v.id} className="text-right">
                        {v.label}
                      </TableHead>
                    ))}
                    {!test.forced_choice && <TableHead className="text-right">No pref.</TableHead>}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.segments.map((s) => (
                    <TableRow key={s.segment}>
                      <TableCell className="font-medium">{s.segment}</TableCell>
                      {summary.variants.map((v) => (
                        <TableCell key={v.id} className="text-right tabular-nums">
                          {s.perVariant[v.id] || 0}
                        </TableCell>
                      ))}
                      {!test.forced_choice && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {s.noPreference}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">{s.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Rationale feed */}
          {test.collect_rationale && (
            <Card>
              <CardHeader>
                <CardTitle>Reasons</CardTitle>
                <CardDescription>What voters said, attributed by segment only.</CardDescription>
              </CardHeader>
              <CardContent>
                {rationales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No written reasons yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {rationales.map((r) => (
                      <li key={r.id} className="flex gap-3 rounded-lg border border-border p-4">
                        <Quote className="size-4 shrink-0 text-muted-foreground" />
                        <div className="space-y-1.5">
                          <p className="text-sm leading-relaxed">{r.rationale}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="muted">{r.segment}</Badge>
                            {r.noPref ? (
                              <Badge variant="outline">No preference</Badge>
                            ) : (
                              r.label && <Badge variant="accent">Chose {r.label}</Badge>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Thresholds for the leaning indicator are configured centrally. This tool reports
            directional preference only — it never computes statistical significance or p-values.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 font-serif text-3xl tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SplitBar({
  label,
  caption,
  count,
  pct,
  muted,
}: {
  label: string;
  caption: string | null;
  count: number;
  pct: number;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {label}
          {caption && <span className="ml-2 font-normal text-muted-foreground">{caption}</span>}
        </span>
        <span className="tabular-nums text-sm">
          {Math.round(pct)}% <span className="text-muted-foreground">({count})</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={muted ? "h-full rounded-full bg-muted-foreground/40" : "h-full rounded-full bg-accent"}
          style={{ width: `${Math.max(pct, 1.5)}%` }}
        />
      </div>
    </div>
  );
}

function Note({
  children,
  icon,
  variant = "default",
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  variant?: "default" | "warning";
}) {
  return (
    <div
      className={
        "flex items-start gap-2.5 rounded-lg border p-3.5 text-sm " +
        (variant === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-border bg-secondary/50 text-muted-foreground")
      }
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function fmtRate(pct: number | null): string {
  if (pct === null) return "—";
  return `${Math.round(pct)}%`;
}
