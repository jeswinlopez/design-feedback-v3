import { useMemo, useRef, useState } from "react";
import { Upload, Users } from "lucide-react";
import { importVoters, type PanelRow } from "./api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/ui/toast";

// Parse "email,name,segment" rows from pasted text or a CSV file. A leading header row
// containing "email" is skipped. Only email is required.
function parsePanel(text: string): PanelRow[] {
  const rows: PanelRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(/[,\t;]/).map((c) => c.trim());
    if (i === 0 && /email/i.test(cells[0]) && !cells[0].includes("@")) continue; // header
    const [email, name, segment] = cells;
    if (!email || !email.includes("@")) continue;
    rows.push({ email, name: name || null, segment: segment || null });
  }
  return rows;
}

export function PanelImport({
  testId,
  locked,
  onImported,
}: {
  testId: string;
  locked: boolean;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parsePanel(text), [text]);

  async function doImport() {
    setBusy(true);
    try {
      const n = await importVoters(testId, parsed);
      if (n > 0) {
        toast({ variant: "success", title: `Added ${n} panelist${n === 1 ? "" : "s"}` });
        setText("");
        onImported();
      } else {
        toast({ title: "Nothing to add", description: "All emails were duplicates or invalid." });
      }
    } catch (e) {
      toast({ variant: "error", title: "Import failed", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Add panelists</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={locked}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" /> Upload CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
            e.target.value = "";
          }}
        />
      </div>
      <Textarea
        value={text}
        disabled={locked}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"email, name, segment\njane@company.com, Jane Doe, Design\nsam@company.com, Sam Lee, Eng"}
        className="font-mono text-xs"
      />
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" />
          {parsed.length} valid row{parsed.length === 1 ? "" : "s"} detected
        </p>
        <Button type="button" disabled={locked || busy || parsed.length === 0} onClick={doImport}>
          {busy && <Spinner />}
          Add to panel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        De-duplicated by email. A unique single-use token is minted per panelist on add.
      </p>
    </div>
  );
}
