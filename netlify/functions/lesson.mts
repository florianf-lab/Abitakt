// GET  /api/lesson?topicId=…&level=…  -> { status: "ready", lesson } | { status: "pending" } | { status: "failed" } | { status: "none" }
// POST /api/lesson  { topicId, level }  -> same, and starts a background generation if needed.
// Generation itself runs in lesson-generate.mts (background function, up to 15 min).
import { getStore } from "@netlify/blobs";
import { MATHE_TOPICS, LEVELS, lessonKey, monthKey } from "../lib/lesson-core.mts";
import { acquireLock, releaseLock, failLock, reserveSlot, releaseSlot } from "../lib/atomic.mts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// The background job may run up to 15 min, so the lease has to outlast it –
// otherwise a second (billed) generation starts while the first is still going.
const LOCK_MS = 16 * 60 * 1000;
const RETRY_AFTER_FAIL_MS = 30 * 60 * 1000;

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "method" });

  let topicId = "", level = "";
  if (req.method === "GET") {
    const u = new URL(req.url);
    topicId = u.searchParams.get("topicId") || "";
    level = u.searchParams.get("level") || "";
  } else {
    const body: any = await req.json().catch(() => ({}));
    topicId = String(body.topicId || ""); level = String(body.level || "");
  }
  if (!MATHE_TOPICS[topicId] || !(LEVELS as readonly string[]).includes(level)) {
    return json(400, { error: "unknown topic or level" });
  }

  const lessons = getStore("lessons");
  const jobs = getStore("lesson-jobs");
  const key = lessonKey(topicId, level);

  const cached = await lessons.get(key, { type: "json" });
  if (cached) return json(200, { status: "ready", lesson: cached });

  const job: any = await jobs.get(key, { type: "json" });
  const now = Date.now();
  if (job?.state === "running" && now - job.started < LOCK_MS) return json(202, { status: "pending" });
  if (job?.state === "failed" && now - job.at < RETRY_AFTER_FAIL_MS) return json(200, { status: "failed" });
  if (req.method === "GET") return json(200, { status: "none" });

  // One generation per topic at a time. The lock is taken with a conditional
  // write, so two simultaneous requests cannot both win it.
  const lock = await acquireLock(jobs as any, key, LOCK_MS);
  if (!lock.ok) return json(202, { status: "pending" });

  // Budget brake: the slot is reserved *before* anything is billed. A request
  // that loses the race gets a clean 429 instead of quietly overspending.
  const budget = getStore("budget");
  const max = Number(process.env.MAX_GENERATIONS_PER_MONTH || 8);
  const slot = await reserveSlot(budget as any, monthKey(), max);
  if (!slot.ok) {
    await releaseLock(jobs as any, key);
    return json(429, { status: "budget", error: "monthly generation limit reached" });
  }

  // shared secret so only this function can trigger the (billed) background job
  const meta = getStore("lesson-meta");
  let secret = await meta.get("secret", { type: "text" });
  if (!secret) { secret = crypto.randomUUID() + crypto.randomUUID(); await meta.set("secret", secret); }

  const res = await fetch(new URL("/api/lesson-generate", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-abitakt-secret": secret },
    body: JSON.stringify({ topicId, level }),
  }).catch(() => null);
  if (!res || res.status !== 202) {
    await releaseSlot(budget as any, monthKey());   // nothing was billed
    await failLock(jobs as any, key, "could not start background job");
    return json(502, { status: "failed" });
  }
  return json(202, { status: "pending", left: slot.left });
};

export const config = { path: "/api/lesson" };
