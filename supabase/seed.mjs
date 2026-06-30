// Seed script for Design Face-Off.
//
// Creates: one demo admin (so you can log in), one ACTIVE demo test with two generated
// placeholder designs uploaded to the private `designs` bucket, and ~8 demo voters with
// minted tokens. Prints the per-voter /vote/:token links.
//
// Run from your own machine (where Supabase is reachable):
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  [DEMO_ADMIN_EMAIL=you@co.com] \
//   [APP_ORIGIN=http://localhost:5173]  node supabase/seed.mjs
//
// The service role key is required (admin user creation + storage upload) and must NEVER
// be shipped to the browser. This script runs server-side only.

import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "admin@example.com";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:5173";

if (!URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------- minimal PNG encoder (no deps) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePng(w, h, draw) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const [r, g, b] = draw(x, y, w, h);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}
const W = 1000, H = 750;
function band(y, top, bottom) {
  return y > H * top && y < H * bottom;
}
// Variant A — warm "calm" layout
const variantA = makePng(W, H, (x, y) => {
  if (band(y, 0.12, 0.22) && x > W * 0.1 && x < W * 0.55) return [40, 44, 110]; // headline
  if (band(y, 0.26, 0.34) && x > W * 0.1 && x < W * 0.75) return [196, 188, 175]; // subtext
  if (band(y, 0.42, 0.56) && x > W * 0.1 && x < W * 0.38) return [40, 44, 110]; // CTA
  return [244, 239, 230]; // warm stone bg
});
// Variant B — bold "inverted" layout
const variantB = makePng(W, H, (x, y) => {
  if (band(y, 0.12, 0.24) && x > W * 0.1 && x < W * 0.7) return [244, 239, 230]; // big headline
  if (band(y, 0.30, 0.36) && x > W * 0.1 && x < W * 0.6) return [150, 160, 220]; // subtext
  if (band(y, 0.46, 0.6) && x > W * 0.1 && x < W * 0.42) return [255, 255, 255]; // CTA
  return [40, 44, 110]; // indigo bg
});

// ---------- seed ----------
async function ensureAdmin() {
  // Create the auth user (idempotent-ish: ignore "already registered").
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    email_confirm: true,
  });
  let userId = created?.user?.id;
  if (error && !/already/i.test(error.message)) throw error;
  if (!userId) {
    // Find existing user by listing (small projects only).
    const { data: list } = await supabase.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === ADMIN_EMAIL)?.id;
  }
  if (!userId) throw new Error("Could not create or find the admin user.");
  const { error: pErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, email: ADMIN_EMAIL, name: "Demo Admin", role: "admin" });
  if (pErr) throw pErr;
  return userId;
}

async function run() {
  const ownerId = await ensureAdmin();
  console.log(`✓ Admin ready: ${ADMIN_EMAIL}`);

  const { data: test, error: tErr } = await supabase
    .from("tests")
    .insert({
      owner_id: ownerId,
      title: "Checkout hero — calm vs bold",
      description: "Which hero treatment do you prefer for the new checkout screen?",
      status: "active",
      forced_choice: false,
      collect_rationale: true,
      randomize_position: true,
      recruitment_note: "Recruited from the internal #design-feedback channel (volunteers).",
      activated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (tErr) throw tErr;
  console.log(`✓ Test created: ${test.id}`);

  const { data: variants, error: vErr } = await supabase
    .from("variants")
    .insert([
      { test_id: test.id, label: "A", sort_index: 0, caption: "Calm — generous whitespace, single CTA" },
      { test_id: test.id, label: "B", sort_index: 1, caption: "Bold — inverted, high contrast" },
    ])
    .select();
  if (vErr) throw vErr;

  for (const v of variants) {
    const png = v.label === "A" ? variantA : variantB;
    const path = `tests/${test.id}/${v.id}.png`;
    const { error: upErr } = await supabase.storage
      .from("designs")
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;
    await supabase.from("variants").update({ image_path: path }).eq("id", v.id);
  }
  console.log("✓ Uploaded 2 placeholder designs");

  const panel = [
    { email: "jane@example.com", name: "Jane Doe", segment: "Design" },
    { email: "sam@example.com", name: "Sam Lee", segment: "Engineering" },
    { email: "priya@example.com", name: "Priya N", segment: "Design" },
    { email: "marco@example.com", name: "Marco B", segment: "Product" },
    { email: "lena@example.com", name: "Lena K", segment: "Engineering" },
    { email: "omar@example.com", name: "Omar H", segment: "Product" },
    { email: "yuki@example.com", name: "Yuki T", segment: "Marketing" },
    { email: "dana@example.com", name: "Dana R", segment: "Marketing" },
  ];
  const { data: voters, error: voErr } = await supabase
    .from("voters")
    .insert(panel.map((p) => ({ test_id: test.id, ...p })))
    .select();
  if (voErr) throw voErr;

  console.log(`✓ ${voters.length} voters created\n`);
  console.log("Invite links (hand these out):");
  for (const v of voters) {
    console.log(`  ${v.email.padEnd(22)} ${APP_ORIGIN}/vote/${v.token}`);
  }
  console.log(`\nAdmin: open ${APP_ORIGIN}/login and sign in as ${ADMIN_EMAIL}.`);
}

run().catch((e) => {
  console.error("Seed failed:", e.message || e);
  process.exit(1);
});
