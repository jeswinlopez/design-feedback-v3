import { FUNCTIONS_BASE } from "./supabase";
import type { BallotResponse, CastVoteResponse } from "./types";

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Edge Functions are verify_jwt=true, so we send the anon/publishable key. We use raw
// fetch (not functions.invoke) so we can read the JSON body on a 409 typed error too.
async function callFn<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });
  // get_ballot/cast_vote always return JSON (200 or 409); other codes => network error.
  if (res.status >= 500) throw new Error(`server_error_${res.status}`);
  return (await res.json()) as T;
}

const BALLOT_STATES: ReadonlyArray<BallotResponse["state"]> = [
  "open",
  "already_voted",
  "closed",
  "invalid",
];

export async function getBallot(token: string): Promise<BallotResponse> {
  // Any non-typed response (platform 401/403/429, unexpected body) must degrade to the
  // "invalid" screen rather than flow through with an undefined state and crash the UI.
  let res: BallotResponse;
  try {
    res = await callFn<BallotResponse>("get_ballot", { token });
  } catch {
    return { state: "invalid" };
  }
  if (!res || !BALLOT_STATES.includes(res.state)) return { state: "invalid" };
  return res;
}

export function castVote(input: {
  token: string;
  variant_id: string | null;
  no_preference: boolean;
  rationale: string | null;
}) {
  return callFn<CastVoteResponse>("cast_vote", input);
}
