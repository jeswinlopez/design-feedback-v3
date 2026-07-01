import { classifyLeaning, marginPtsFromTopTwo, LEANING_CONFIG, type Leaning } from "@/lib/config";
import type { ResultsData } from "./api";

export interface VariantResult {
  id: string;
  label: string;
  caption: string | null;
  count: number; // decisive picks for this variant
  pctOfAll: number; // share of all responses (incl. no-preference)
  // Position correction (null when a position group has no data):
  firstShown: number;
  firstWins: number;
  secondShown: number;
  secondWins: number;
  winRateFirstPct: number | null;
  winRateSecondPct: number | null;
  balancedPct: number | null;
}

export interface SegmentRow {
  segment: string;
  total: number;
  perVariant: Record<string, number>; // variantId -> count
  noPreference: number;
}

export interface ResultsSummary {
  totalResponses: number;
  decisiveVotes: number;
  noPreferenceCount: number;
  noPreferencePct: number;
  variants: VariantResult[];
  leader: VariantResult | null;
  marginPts: number;
  leaning: Leaning;
  positionRandomized: boolean;
  positionCorrectable: boolean;
  firstPositionWinRatePct: number | null;
  positionBias: boolean;
  segments: SegmentRow[];
  invited: number;
  voted: number;
  completionPct: number;
  timeline: { t: string; cumulative: number }[];
}

function rate(part: number, whole: number): number | null {
  if (!whole) return null;
  return (part / whole) * 100;
}

export function computeResults(
  data: ResultsData,
  positionRandomized: boolean,
): ResultsSummary {
  const { variants, votes, voters } = data;
  const segmentOf = new Map(voters.map((v) => [v.id, v.segment]));

  const decisive = votes.filter((v) => !v.no_preference && v.variant_id);
  const noPref = votes.filter((v) => v.no_preference);
  const totalResponses = votes.length;

  const variantResults: VariantResult[] = variants.map((variant) => {
    const picks = decisive.filter((v) => v.variant_id === variant.id);

    // Position groups: ballots where THIS variant was shown first vs second.
    const shownFirst = decisive.filter((v) => v.shown_first_variant_id === variant.id);
    const shownSecond = decisive.filter(
      (v) => v.shown_first_variant_id && v.shown_first_variant_id !== variant.id,
    );
    const firstWins = shownFirst.filter((v) => v.variant_id === variant.id).length;
    const secondWins = shownSecond.filter((v) => v.variant_id === variant.id).length;

    const winRateFirstPct = rate(firstWins, shownFirst.length);
    const winRateSecondPct = rate(secondWins, shownSecond.length);
    const balancedPct =
      winRateFirstPct !== null && winRateSecondPct !== null
        ? (winRateFirstPct + winRateSecondPct) / 2
        : null;

    return {
      id: variant.id,
      label: variant.label,
      caption: variant.caption,
      count: picks.length,
      pctOfAll: totalResponses ? (picks.length / totalResponses) * 100 : 0,
      firstShown: shownFirst.length,
      firstWins,
      secondShown: shownSecond.length,
      secondWins,
      winRateFirstPct,
      winRateSecondPct,
      balancedPct,
    };
  });

  // Leader + margin among decisive votes. Uses the shared top-two helper so the results
  // page and the dashboard badge derive leaning identically.
  const sorted = [...variantResults].sort((a, b) => b.count - a.count);
  const leader = sorted[0] ?? null;
  const runnerUp = sorted[1] ?? null;
  const marginPts = marginPtsFromTopTwo(leader?.count ?? 0, runnerUp?.count ?? 0, decisive.length);
  const leaning = classifyLeaning(marginPts, decisive.length);

  // First-position advantage: how often the first-shown option was chosen (decisive only).
  const firstShownChosen = decisive.filter(
    (v) => v.shown_first_variant_id && v.variant_id === v.shown_first_variant_id,
  ).length;
  const firstPositionWinRatePct = rate(firstShownChosen, decisive.length);
  const positionCorrectable =
    positionRandomized && variantResults.every((v) => v.firstShown > 0 && v.secondShown > 0);
  const positionBias =
    positionCorrectable &&
    firstPositionWinRatePct !== null &&
    Math.abs(firstPositionWinRatePct - 50) >= LEANING_CONFIG.positionBiasGapPts;

  // Segment breakdown.
  const segMap = new Map<string, SegmentRow>();
  for (const v of votes) {
    const seg = segmentOf.get(v.voter_id) || "Unsegmented";
    let row = segMap.get(seg);
    if (!row) {
      row = { segment: seg, total: 0, perVariant: {}, noPreference: 0 };
      segMap.set(seg, row);
    }
    row.total += 1;
    if (v.no_preference || !v.variant_id) row.noPreference += 1;
    else row.perVariant[v.variant_id] = (row.perVariant[v.variant_id] || 0) + 1;
  }
  const segments = [...segMap.values()].sort((a, b) => b.total - a.total);

  // Completion + cumulative timeline.
  const invited = voters.length;
  const voted = voters.filter((v) => v.voted_at).length;
  const ordered = [...votes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const timeline = ordered.map((v, i) => ({ t: v.created_at, cumulative: i + 1 }));

  return {
    totalResponses,
    decisiveVotes: decisive.length,
    noPreferenceCount: noPref.length,
    noPreferencePct: totalResponses ? (noPref.length / totalResponses) * 100 : 0,
    variants: variantResults,
    leader,
    marginPts,
    leaning,
    positionRandomized,
    positionCorrectable,
    firstPositionWinRatePct,
    positionBias,
    segments,
    invited,
    voted,
    completionPct: invited ? Math.round((voted / invited) * 100) : 0,
    timeline,
  };
}

export interface VoteRow {
  segment: string;
  choice_label: string;
  no_preference: boolean;
  rationale: string;
  shown_first_label: string;
  created_at: string;
}

/** Per-vote rows for CSV export (§9) — segment, not email/name. */
export function buildVoteRows(data: ResultsData): VoteRow[] {
  const labelOf = new Map(data.variants.map((v) => [v.id, v.label]));
  const segmentOf = new Map(data.voters.map((v) => [v.id, v.segment]));
  return data.votes
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((v) => ({
      segment: segmentOf.get(v.voter_id) || "Unsegmented",
      choice_label: v.no_preference ? "" : labelOf.get(v.variant_id ?? "") || "",
      no_preference: v.no_preference,
      rationale: v.rationale || "",
      shown_first_label: labelOf.get(v.shown_first_variant_id ?? "") || "",
      created_at: v.created_at,
    }));
}
