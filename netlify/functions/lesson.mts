// GET  /api/lesson?topicId=…&level=…  -> { status: "ready", lesson } | { status: "pending" } | { status: "failed" } | { status: "none" }
// POST /api/lesson  { topicId, level }  -> same, and starts a background generation if needed.
// Generation itself runs in lesson-generate.mts (background function, up to 15 min).
import { getStore } from "@netlify/blobs";
import { MATHE_TOPICS, LEVELS, lessonKey, monthKey } from "../lib/lesson-core.mts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const LOCK_MS = 6 * 60 * 1000;      // a generation normally takes 1–3 min
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

  // budget brake
  const budget = getStore("budget");
  const max = Number(process.env.MAX_GENERATIONS_PER_MONTH || 8);
  const month: any = (await budget.get(monthKey(), { type: "json" })) || { generations: 0 };
  if (month.generations >= max) return json(429, { status: "budget", error: "monthly generation limit reached" });

  // shared secret so only this function can trigger the (billed) background job
  const meta = getStore("lesson-meta");
  let secret = await meta.get("secret");
  if (!secret) { secret = crypto.randomUUID() + crypto.randomUUID(); await meta.set("secret", secret); }

  await jobs.setJSON(key, { state: "running", started: now });
  const res = await fetch(new URL("/api/lesson-generate", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-abitakt-secret": secret },
    body: JSON.stringify({ topicId, level }),
  }).catch(() => null);
  if (!res || res.status !== 202) {
    await jobs.setJSON(key, { state: "failed", at: now, reason: "could not start background job" });
    return json(502, { status: "failed" });
  }
  return json(202, { status: "pending" });
};

export const config = { path: "/api/lesson" };
