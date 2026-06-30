// Domain types mirroring the DB schema (§5) and the Edge Function contracts (§7).

export type TestStatus = "draft" | "active" | "closed";

export interface Test {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: TestStatus;
  forced_choice: boolean;
  collect_rationale: boolean;
  randomize_position: boolean;
  recruitment_note: string | null;
  auto_close_at: string | null;
  close_vote_threshold: number | null;
  created_at: string;
  activated_at: string | null;
  closed_at: string | null;
}

export interface Variant {
  id: string;
  test_id: string;
  label: "A" | "B" | string;
  image_path: string | null;
  caption: string | null;
  sort_index: number;
  created_at: string;
}

export interface Voter {
  id: string;
  test_id: string;
  email: string;
  name: string | null;
  segment: string | null;
  token: string;
  invited_at: string | null;
  voted_at: string | null;
  created_at: string;
}

export interface Vote {
  id: string;
  test_id: string;
  voter_id: string;
  variant_id: string | null;
  no_preference: boolean;
  rationale: string | null;
  shown_first_variant_id: string | null;
  created_at: string;
}

// ---- Edge Function payloads ----

export type BallotState = "open" | "already_voted" | "closed" | "invalid";

export interface BallotVariant {
  id: string;
  label: string;
  caption: string | null;
  url: string | null; // signed Storage URL, present only when state === "open"
}

export interface BallotResponse {
  state: BallotState;
  test?: {
    title: string;
    description: string | null;
    status: TestStatus;
    forced_choice: boolean;
    collect_rationale: boolean;
  };
  variants?: BallotVariant[];
}

export type CastVoteCode =
  | "already_voted"
  | "test_closed"
  | "invalid_token"
  | "invalid_choice"
  | "server_error"
  | "method_not_allowed";

export interface CastVoteResponse {
  status: "ok" | "error";
  code?: CastVoteCode;
}
