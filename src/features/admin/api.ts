import { supabase } from "@/lib/supabase";
import type { Test, TestStatus, Variant, Voter, Vote } from "@/lib/types";

export interface TestOverview extends Test {
  invited_count: number;
  voted_count: number;
  decisive_n: number;
  top_count: number;
}

export async function fetchOverview(): Promise<TestOverview[]> {
  const { data, error } = await supabase
    .from("admin_test_overview")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TestOverview[];
}

export async function fetchTest(id: string): Promise<Test> {
  const { data, error } = await supabase.from("tests").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Test;
}

export async function fetchVariants(testId: string): Promise<Variant[]> {
  const { data, error } = await supabase
    .from("variants")
    .select("*")
    .eq("test_id", testId)
    .order("sort_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Variant[];
}

export async function fetchVoters(testId: string): Promise<Voter[]> {
  const { data, error } = await supabase
    .from("voters")
    .select("*")
    .eq("test_id", testId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Voter[];
}

export interface TestInput {
  title: string;
  description: string | null;
  forced_choice: boolean;
  collect_rationale: boolean;
  randomize_position: boolean;
  recruitment_note: string | null;
  auto_close_at: string | null;
  close_vote_threshold: number | null;
}

export async function createTest(ownerId: string, input: TestInput): Promise<Test> {
  const { data, error } = await supabase
    .from("tests")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  // Seed the two empty variant rows (A/B) so uploads have a target id (path scheme §8).
  const test = data as Test;
  const existing = await fetchVariants(test.id);
  if (existing.length === 0) {
    const { error: vErr } = await supabase.from("variants").insert([
      { test_id: test.id, label: "A", sort_index: 0 },
      { test_id: test.id, label: "B", sort_index: 1 },
    ]);
    if (vErr) throw vErr;
  }
  return test;
}

export async function updateTest(id: string, input: Partial<TestInput>): Promise<void> {
  const { error } = await supabase.from("tests").update(input).eq("id", id);
  if (error) throw error;
}

export async function updateVariant(
  id: string,
  patch: Partial<Pick<Variant, "caption" | "image_path">>,
): Promise<void> {
  const { error } = await supabase.from("variants").update(patch).eq("id", id);
  if (error) throw error;
}

/** Upload an image to the private `designs` bucket at tests/{test}/{variant}.{ext}. */
export async function uploadVariantImage(
  testId: string,
  variant: Variant,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `tests/${testId}/${variant.id}.${ext}`;
  const { error } = await supabase.storage
    .from("designs")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  await updateVariant(variant.id, { image_path: path });
  return path;
}

/** Admin-side preview URL for a stored design (admin has storage RLS on own objects). */
export async function getSignedUrl(path: string, ttl = 600): Promise<string | null> {
  const { data, error } = await supabase.storage.from("designs").createSignedUrl(path, ttl);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export interface PanelRow {
  email: string;
  name?: string | null;
  segment?: string | null;
}

/** Insert new panelists, de-duped by email against what already exists. Returns inserted count. */
export async function importVoters(testId: string, rows: PanelRow[]): Promise<number> {
  const existing = await fetchVoters(testId);
  const seen = new Set(existing.map((v) => v.email.toLowerCase()));
  const deduped: PanelRow[] = [];
  const within = new Set<string>();
  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    if (!email || seen.has(email) || within.has(email)) continue;
    within.add(email);
    deduped.push({ email, name: r.name?.trim() || null, segment: r.segment?.trim() || null });
  }
  if (deduped.length === 0) return 0;
  // token is minted by the DB default (app_gen_token); we never set it from the client.
  const { error } = await supabase
    .from("voters")
    .insert(deduped.map((r) => ({ test_id: testId, ...r })));
  if (error) throw error;
  return deduped.length;
}

export async function removeVoter(id: string): Promise<void> {
  const { error } = await supabase.from("voters").delete().eq("id", id);
  if (error) throw error;
}

export async function setStatus(id: string, status: TestStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "active") patch.activated_at = new Date().toISOString();
  if (status === "closed") patch.closed_at = new Date().toISOString();
  const { error } = await supabase.from("tests").update(patch).eq("id", id);
  if (error) throw error;
}

export interface ResultsData {
  variants: Variant[];
  votes: Vote[];
  voters: Pick<Voter, "id" | "segment" | "invited_at" | "voted_at">[];
}

export async function fetchResultsData(testId: string): Promise<ResultsData> {
  const [variants, votesRes, votersRes] = await Promise.all([
    fetchVariants(testId),
    supabase.from("votes").select("*").eq("test_id", testId),
    supabase.from("voters").select("id, segment, invited_at, voted_at").eq("test_id", testId),
  ]);
  if (votesRes.error) throw votesRes.error;
  if (votersRes.error) throw votersRes.error;
  return {
    variants,
    votes: (votesRes.data ?? []) as Vote[],
    voters: (votersRes.data ?? []) as ResultsData["voters"],
  };
}
