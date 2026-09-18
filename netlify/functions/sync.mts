// Zero-knowledge profile sync.
//
// The server never sees a profile: the client encrypts everything with a key
// derived from a passphrase that never leaves the device. What is stored here
// is an opaque blob plus a revision counter. No e-mail, no password, no account.
//
// POST /api/sync { action: "create" }                  -> { id, rev: 0 }
// GET  /api/sync?id=…                                  -> { status, blob, rev, updated }
// POST /api/sync { action: "put", id, blob, rev }      -> { status: "ok", rev } | 409 conflict
// POST /api/sync { action: "delete", id, rev }         -> { status: "ok" }
import { getStore } from "@netlify/blobs";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// No I, O, 0, 1 – the code gets written down by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUPS = 3, PER_GROUP = 4;
const MAX_BLOB = 700_000;          // characters of base64 ≈ 512 KB of profile
const ID_RE = new RegExp(`^[${ALPHABET}]{${PER_GROUP}}(-[${ALPHABET}]{${PER_GROUP}}){${GROUPS - 1}}$`);

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(GROUPS * PER_GROUP));
  const chars = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]);
  return Array.from({ length: GROUPS }, (_, g) => chars.slice(g * PER_GROUP, (g + 1) * PER_GROUP).join("")).join("-");
}
const normalizeId = (s: unknown) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  .replace(new RegExp(`(.{${PER_GROUP}})(?=.)`, "g"), "$1-");

async function countDay(store: any, name: string, max: number) {
  const day = new Date().toISOString().slice(0, 10);
  const rec: any = (await store.get(name, { type: "json", consistency: "strong" })) || { day: "", n: 0 };
  if (rec.day !== day) { rec.day = day; rec.n = 0; }
  if (rec.n >= max) return false;
  rec.n++;
  await store.setJSON(name, rec);
  return true;
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const store = getStore("sync");

  if (req.method === "GET") {
    const id = normalizeId(new URL(req.url).searchParams.get("id"));
    if (!ID_RE.test(id)) return json(400, { status: "bad_id" });
    const rec: any = await store.get("v1/" + id, { type: "json", consistency: "strong" });
    if (!rec) return json(404, { status: "none" });
    return json(200, { status: "ready", blob: rec.blob, rev: rec.rev, updated: rec.updated });
  }
  if (req.method !== "POST") return json(405, { error: "method" });

  const body: any = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "create") {
    if (!(await countDay(getStore("budget"), "sync-creates", Number(process.env.MAX_SYNC_CREATES_PER_DAY || 300))))
      return json(429, { status: "busy" });
    for (let i = 0; i < 5; i++) {
      const id = newId();
      if (await store.get("v1/" + id, { type: "json", consistency: "strong" })) continue;
      await store.setJSON("v1/" + id, { blob: "", rev: 0, updated: Date.now(), created: Date.now() });
      return json(200, { status: "ok", id, rev: 0 });
    }
    return json(503, { status: "busy" });
  }

  const id = normalizeId(body.id);
  if (!ID_RE.test(id)) return json(400, { status: "bad_id" });
  const key = "v1/" + id;
  const rec: any = await store.get(key, { type: "json", consistency: "strong" });
  if (!rec) return json(404, { status: "none" });

  if (action === "put") {
    const blob = String(body.blob || "");
    if (!blob || blob.length > MAX_BLOB) return json(413, { status: "too_large" });
    if (!/^[A-Za-z0-9+/=]+$/.test(blob)) return json(400, { status: "bad_blob" });
    const rev = Number(body.rev);
    if (!(rev >= 0)) return json(400, { status: "bad_rev" });
    if (rev !== rec.rev) return json(409, { status: "conflict", blob: rec.blob, rev: rec.rev, updated: rec.updated });
    if (!(await countDay(getStore("budget"), "sync-writes", Number(process.env.MAX_SYNC_WRITES_PER_DAY || 5000))))
      return json(429, { status: "busy" });
    const next = { blob, rev: rec.rev + 1, updated: Date.now(), created: rec.created || Date.now() };
    await store.setJSON(key, next);
    return json(200, { status: "ok", rev: next.rev, updated: next.updated });
  }
  if (action === "delete") {
    await store.delete(key);
    return json(200, { status: "ok" });
  }
  return json(400, { status: "bad_action" });
};
export const config = { path: "/api/sync" };
