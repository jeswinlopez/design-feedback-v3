import { useState } from "react";
import { Copy, Check, Download, Trash2, CheckCircle2 } from "lucide-react";
import type { Voter } from "@/lib/types";
import { removeVoter } from "./api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { toCsv, downloadCsv, slugify } from "@/lib/utils";

function voteUrl(token: string) {
  return `${window.location.origin}/vote/${token}`;
}

export function InviteLinks({
  voters,
  testTitle,
  locked,
  onChange,
}: {
  voters: Voter[];
  testTitle: string;
  locked: boolean;
  onChange: () => void;
}) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyOne(v: Voter) {
    await navigator.clipboard.writeText(voteUrl(v.token));
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function copyAll() {
    const text = voters.map((v) => `${v.email}\t${voteUrl(v.token)}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast({ variant: "success", title: "Copied all links" });
  }

  function exportCsv() {
    const csv = toCsv(
      ["email", "segment", "link"],
      voters.map((v) => [v.email, v.segment ?? "", voteUrl(v.token)]),
    );
    downloadCsv(`${slugify(testTitle)}-invite-links.csv`, csv);
  }

  if (voters.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No panelists yet. Add some above, then links appear here to hand off for distribution.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {voters.length} link{voters.length === 1 ? "" : "s"} · no email is sent — distribute these yourself
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyAll}>
            <Copy className="size-4" /> Copy all
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Email</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {voters.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.email}</TableCell>
                <TableCell className="text-muted-foreground">{v.segment ?? "—"}</TableCell>
                <TableCell>
                  {v.voted_at ? (
                    <Badge variant="success">
                      <CheckCircle2 className="size-3" /> Voted
                    </Badge>
                  ) : (
                    <Badge variant="muted">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => copyOne(v)}>
                      {copiedId === v.id ? (
                        <>
                          <Check className="size-4 text-success" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" /> Copy
                        </>
                      )}
                    </Button>
                    {!locked && !v.voted_at && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await removeVoter(v.id);
                          onChange();
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
