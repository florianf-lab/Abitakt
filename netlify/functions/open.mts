// GET  /api/open?topicId=…&level=…  -> { status: "ready", tasks } | pending | failed | none
// POST /api/open  { topicId, level } -> starts a background generation if needed.
import { getStore } from "@netlify/blobs";
import { LEVELS } from "../lib/lesson-core.mts";
import { topicInfo, openKey } from "../lib/ai-core.mts";
import { acquireLock, releaseLock, failLock, reserveSlot, releaseSlot } from "../lib/atomic.mts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
// must outlast the background job, otherwise a second (billed) run starts
const LOCK_MS = 16 * 60 * 1000, RETRY_MS = 30 * 60 * 1000;

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  let topicId = "", level = "";
  if (req.method === "GET") {
    const u = new URL(req.url);
    topicId = u.searchParams.get("topicId") || ""; level = u.searchParams.get("level") || "";
  } else if (req.method === "POST") {
    const b: any = await req.json().catch(() => ({}));
    topicId = String(b.topicId || ""); level = String(b.level || "");
  } else return json(405, { error: "method" });

  if (!topicInfo(topicId) || !(LEVELS as readonly string[]).includes(level)) return json(400, { error: "unknown topic or level" });

  const store = getStore("open-tasks"), jobs = getStore("open-jobs");
  const key = openKey(topicId, level);
  const cached = await store.get(key, { type: "json" });
  if (cached) return json(200, { status: "ready", tasks: cached.tasks });

  const job: any = await jobs.get(key, { type: "json", consistency: "strong" });
  const now = Date.now();
  if (job?.state === "running" && now - job.started < LOCK_MS) return json(202, { status: "pending" });
  if (job?.state === "failed" && now - job.at < RETRY_MS) return json(200, { status: "failed" });
  if (req.method === "GET") return json(200, { status: "none" });

  const lock = await acquireLock(jobs as any, key, LOCK_MS);
  if (!lock.ok) return json(202, { status: "pending" });

  const budget = getStore("budget");
  const max = Number(process.env.MAX_OPEN_SETS_PER_MONTH || 12);
  const budgetKey = "open-" + new Date().toISOString().slice(0, 7);
  const slot = await reserveSlot(budget as any, budgetKey, max);
  if (!slot.ok) { await releaseLock(jobs as any, key); return json(429, { status: "budget" }); }

  const meta = getStore("lesson-meta");
  let secret = await meta.get("secret", { type: "text" });
  if (!secret) { secret = crypto.randomUUID() + crypto.randomUUID(); await meta.set("secret", secret); }

  const res = await fetch(new URL("/api/open-generate", req.url), {
    method: "POST", headers: { "Content-Type": "application/json", "x-abitakt-secret": secret },
    body: JSON.stringify({ topicId, level }),
  }).catch(() => null);
  if (!res || res.status !== 202) {
    await releaseSlot(budget as any, budgetKey);
    await failLock(jobs as any, key, "could not start background job");
    return json(502, { status: "failed" });
  }
  return json(202, { status: "pending", left: slot.left });
};
export const config = { path: "/api/open" };
