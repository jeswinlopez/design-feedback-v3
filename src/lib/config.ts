// Single source of truth for the leaning indicator (§9). Tune here only.
// IMPORTANT: this is stated-preference signal, never a conversion/significance claim.
// We never surface p-values or the word "significance".

export type Leaning = "Inconclusive" | "Leaning" | "Clear" | "Decisive";

export const LEANING_CONFIG = {
  // margin = |winner% - runnerUp%| in percentage points; n = decisive votes counted.
  inconclusive: { maxMarginPts: 10, minN: 10 }, // below either => Inconclusive
  clear: { minMarginPts: 20, minN: 20 },
  decisive: { minMarginPts: 35, minN: 30 },
  // Position-bias note threshold: gap between shown-first and shown-second win rates.
  positionBiasGapPts: 20,
} as const;

export function classifyLeaning(marginPts: number, n: number): Leaning {
  const { inconclusive, clear, decisive } = LEANING_CONFIG;
  if (n < inconclusive.minN || marginPts < inconclusive.maxMarginPts) return "Inconclusive";
  if (marginPts >= decisive.minMarginPts && n >= decisive.minN) return "Decisive";
  if (marginPts >= clear.minMarginPts && n >= clear.minN) return "Clear";
  return "Leaning";
}

/** Percentage-point margin between the two leading tallies over the decisive vote count. */
export function marginPtsFromTopTwo(topCount: number, secondCount: number, decisiveN: number): number {
  return decisiveN ? Math.round(((topCount - secondCount) / decisiveN) * 100) : 0;
}

/** Single source for turning the top-two decisive tallies into a leaning label. Used by
 *  both the dashboard (from the overview view) and the results page (from full vote data)
 *  so the two never disagree. v1 has exactly 2 variants. */
export function leaningFromTopTwo(topCount: number, secondCount: number, decisiveN: number): Leaning {
  return classifyLeaning(marginPtsFromTopTwo(topCount, secondCount, decisiveN), decisiveN);
}

// Upload constraints (§8), enforced client-side; server caps via bucket config.
export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024, // ~10MB
  acceptedTypes: ["image/png", "image/jpeg", "image/webp"] as const,
  acceptAttr: "image/png,image/jpeg,image/webp",
};
