import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Lock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Test } from "@/lib/types";
import {
  createTest,
  fetchTest,
  fetchVariants,
  fetchVoters,
  setStatus,
  updateTest,
  type TestInput,
} from "./api";
import { VariantUploader } from "./VariantUploader";
import { PanelImport } from "./PanelImport";
import { InviteLinks } from "./InviteLinks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { FullPageSpinner, Spinner } from "@/components/Spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

const BLANK: TestInput = {
  title: "",
  description: null,
  forced_choice: true,
  collect_rationale: true,
  randomize_position: true,
  recruitment_note: null,
  auto_close_at: null,
  close_vote_threshold: null,
};

export function TestEditorPage({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<TestInput>(BLANK);
  const [saving, setSaving] = useState(false);

  const testQuery = useQuery({
    queryKey: ["test", id],
    queryFn: () => fetchTest(id!),
    enabled: mode === "edit" && !!id,
  });
  const variantsQuery = useQuery({
    queryKey: ["variants", id],
    queryFn: () => fetchVariants(id!),
    enabled: mode === "edit" && !!id,
  });
  const votersQuery = useQuery({
    queryKey: ["voters", id],
    queryFn: () => fetchVoters(id!),
    enabled: mode === "edit" && !!id,
  });

  const test = testQuery.data;
  useEffect(() => {
    if (test) {
      setForm({
        title: test.title,
        description: test.description,
        forced_choice: test.forced_choice,
        collect_rationale: test.collect_rationale,
        randomize_position: test.randomize_position,
        recruitment_note: test.recruitment_note,
        auto_close_at: test.auto_close_at,
        close_vote_threshold: test.close_vote_threshold,
      });
    }
  }, [test]);

  const status = test?.status ?? "draft";
  const locked = status !== "draft"; // activating locks variants + panel + integrity toggles

  function set<K extends keyof TestInput>(key: K, value: TestInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ variant: "error", title: "Title is required" });
      return;
    }
    setSaving(true);
    try {
      if (mode === "new") {
        const created = await createTest(profile!.id, form);
        toast({ variant: "success", title: "Test created" });
        navigate(`/admin/tests/${created.id}`, { replace: true });
      } else {
        await updateTest(id!, form);
        await qc.invalidateQueries({ queryKey: ["test", id] });
        await qc.invalidateQueries({ queryKey: ["overview"] });
        toast({ variant: "success", title: "Saved" });
      }
    } catch (e) {
      toast({ variant: "error", title: "Save failed", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["variants", id] });
    qc.invalidateQueries({ queryKey: ["voters", id] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  }

  if (mode === "edit" && (testQuery.isLoading || !test)) return <FullPageSpinner />;

  const variants = variantsQuery.data ?? [];
  const voters = votersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">
            <ArrowLeft className="size-4" /> Tests
          </Link>
        </Button>
        {mode === "edit" && (
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            {status !== "draft" && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/admin/tests/${id}/results`}>
                  <BarChart3 className="size-4" /> Results
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div>
        <h1 className="font-serif text-3xl tracking-tight">
          {mode === "new" ? "New test" : test?.title}
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Stated-preference test. Two designs, one panel, single-use links.
        </p>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Title, framing, and how the ballot behaves.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Checkout hero — bold vs calm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              placeholder="Optional context shown to voters."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ToggleField
              label="Forced choice"
              hint="No “no preference” option"
              checked={form.forced_choice}
              disabled={locked}
              onChange={(v) => set("forced_choice", v)}
            />
            <ToggleField
              label="Collect rationale"
              hint="Optional reason field"
              checked={form.collect_rationale}
              disabled={locked}
              onChange={(v) => set("collect_rationale", v)}
            />
            <ToggleField
              label="Randomize position"
              hint="Balance left/right by token"
              checked={form.randomize_position}
              disabled={locked}
              onChange={(v) => set("randomize_position", v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recruit">Recruitment note</Label>
            <Textarea
              id="recruit"
              value={form.recruitment_note ?? ""}
              onChange={(e) => set("recruitment_note", e.target.value || null)}
              placeholder="How was this panel recruited? (selection-bias context for later)"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="autoclose">Auto-close date (optional)</Label>
              <Input
                id="autoclose"
                type="datetime-local"
                value={toLocalInput(form.auto_close_at)}
                onChange={(e) => set("auto_close_at", fromLocalInput(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Close after N votes (optional)</Label>
              <Input
                id="threshold"
                type="number"
                min={1}
                value={form.close_vote_threshold ?? ""}
                onChange={(e) =>
                  set("close_vote_threshold", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="e.g. 50"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Spinner />}
              {mode === "new" ? "Create test" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit-only sections */}
      {mode === "edit" && test && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Designs</CardTitle>
              <CardDescription>
                Upload variant A and B. {locked && "Locked while the test is active or closed."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              {variants.map((v) => (
                <VariantUploader
                  key={v.id}
                  testId={test.id}
                  variant={v}
                  locked={locked}
                  onChange={refresh}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Panel</CardTitle>
              <CardDescription>Import voters and hand off their single-use links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!locked && <PanelImport testId={test.id} locked={locked} onImported={refresh} />}
              <InviteLinks
                voters={voters}
                testTitle={test.title}
                locked={locked}
                onChange={refresh}
              />
            </CardContent>
          </Card>

          <LifecycleCard test={test} variantsReady={variants.every((v) => v.image_path)} voterCount={voters.length} onChanged={() => { qc.invalidateQueries({ queryKey: ["test", id] }); qc.invalidateQueries({ queryKey: ["overview"] }); }} />
        </>
      )}
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function LifecycleCard({
  test,
  variantsReady,
  voterCount,
  onChanged,
}: {
  test: Test;
  variantsReady: boolean;
  voterCount: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const canActivate = variantsReady && voterCount > 0;

  async function activate() {
    setBusy(true);
    try {
      await setStatus(test.id, "active");
      toast({ variant: "success", title: "Test activated", description: "Variants and panel are now locked." });
      setConfirmActivate(false);
      onChanged();
    } catch (e) {
      toast({ variant: "error", title: "Could not activate", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      await setStatus(test.id, "closed");
      toast({ variant: "success", title: "Test closed" });
      onChanged();
    } catch (e) {
      toast({ variant: "error", title: "Could not close", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle</CardTitle>
        <CardDescription>Draft → Active → Closed.</CardDescription>
      </CardHeader>
      <CardContent>
        {test.status === "draft" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {canActivate ? (
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-4" /> Activating locks the designs and panel.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="size-4" /> Upload both designs and add at least one
                  panelist first.
                </span>
              )}
            </div>
            <Button variant="accent" disabled={!canActivate} onClick={() => setConfirmActivate(true)}>
              Activate test
            </Button>
          </div>
        )}
        {test.status === "active" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Live. Voters can submit until you close it
              {test.auto_close_at || test.close_vote_threshold ? " (or auto-close triggers)" : ""}.
            </p>
            <Button variant="outline" disabled={busy} onClick={close}>
              {busy && <Spinner />} Close test
            </Button>
          </div>
        )}
        {test.status === "closed" && (
          <p className="text-sm text-muted-foreground">
            This test is closed. The ballot no longer accepts votes.
          </p>
        )}
      </CardContent>

      <Dialog open={confirmActivate} onOpenChange={setConfirmActivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate this test?</DialogTitle>
            <DialogDescription>
              Once active, the two designs and the panel are locked. Editing them afterward would
              invalidate the data you collect, so it’s blocked. You can still close the test anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmActivate(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={activate} disabled={busy}>
              {busy && <Spinner />} Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}
function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}
