// Compare-and-swap helpers on top of Netlify Blobs.
//
// Why: read-modify-write on a blob is not atomic, so two requests arriving at
// the same moment could both see "7 of 8 used" and both start a (billed)
// generation. Netlify Blobs 11 supports conditional writes (onlyIfNew /
// onlyIfMatch), which turns the counter and the job lock into real
// reservations instead of hopeful bookkeeping.

type AnyStore = {
  getWithMetadata(key: string, opts: any): Promise<{ data: any; etag?: string } | null>;
  setJSON(key: string, data: unknown, opts?: any): Promise<{ modified: boolean; etag?: string }>;
  delete(key: string): Promise<void>;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Read → transform → conditional write, retried on lost races.
 *  `fn` returns the next value, or null to abort without writing. */
export async function casUpdate<T>(
  store: AnyStore, key: string, fn: (current: T | null) => T | null, tries = 6,
): Promise<{ ok: boolean; value: T | null; aborted: boolean }> {
  let current: T | null = null;
  for (let i = 0; i < tries; i++) {
    const rec = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
    current = (rec?.data ?? null) as T | null;
    const next = fn(current);
    if (next === null) return { ok: false, value: current, aborted: true };
    const res = rec && rec.etag
      ? await store.setJSON(key, next, { onlyIfMatch: rec.etag })
      : await store.setJSON(key, next, { onlyIfNew: true });
    if (res.modified) return { ok: true, value: next, aborted: false };
    await sleep(40 + Math.floor(Math.random() * 160));
  }
  return { ok: false, value: current, aborted: false };
}

/* ---------- budget: reserve first, refund only what was never billed ------- */

export type Counter = { used: number; ok: number; failed: number; inputTokens: number; outputTokens: number; calls: number };
const emptyCounter = (): Counter => ({ used: 0, ok: 0, failed: 0, inputTokens: 0, outputTokens: 0, calls: 0 });
/** older records used `generations`; keep their value so a deploy does not reset the month */
const asCounter = (c: any): Counter => c
  ? { ...emptyCounter(), ...c, used: typeof c.used === "number" ? c.used : Number(c.generations || 0) }
  : emptyCounter();

/** Takes one slot of `max` before any billed work starts. */
export async function reserveSlot(store: AnyStore, key: string, max: number): Promise<{ ok: boolean; left: number }> {
  const r = await casUpdate<Counter>(store, key, cur => {
    const c = asCounter(cur);
    if (c.used >= max) return null;
    return { ...c, used: c.used + 1 };
  });
  const used = r.value ? asCounter(r.value).used : max;
  return { ok: r.ok, left: Math.max(0, max - used) };
}

/** Gives a reserved slot back – only when nothing was billed for it. */
export async function releaseSlot(store: AnyStore, key: string): Promise<void> {
  await casUpdate<Counter>(store, key, cur => {
    const c = asCounter(cur);
    return { ...c, used: Math.max(0, c.used - 1) };
  });
}

/** Records the outcome of a reserved slot (the slot itself stays spent). */
export async function recordOutcome(
  store: AnyStore, key: string, usage: { input: number; output: number; calls: number }, ok: boolean,
): Promise<void> {
  await casUpdate<Counter>(store, key, cur => {
    const c = asCounter(cur);
    return { ...c, ok: c.ok + (ok ? 1 : 0), failed: c.failed + (ok ? 0 : 1),
      inputTokens: c.inputTokens + usage.input, outputTokens: c.outputTokens + usage.output, calls: c.calls + usage.calls };
  });
}

/* ---------- day/month budget for the interactive endpoints ---------------- */

export type DayMonth = { day: string; used: number; month: string; monthUsed: number };
export async function spendDayMonth(
  store: AnyStore, key: string, limits: { perDay: number; perMonth: number },
): Promise<{ ok: boolean; left: number; reason?: "day" | "month" }> {
  const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
  let reason: "day" | "month" | undefined;
  const r = await casUpdate<DayMonth>(store, key, cur => {
    const b: DayMonth = cur || { day: "", used: 0, month: "", monthUsed: 0 };
    if (b.day !== day) { b.day = day; b.used = 0; }
    if (b.month !== month) { b.month = month; b.monthUsed = 0; }
    if (b.used >= limits.perDay) { reason = "day"; return null; }
    if (b.monthUsed >= limits.perMonth) { reason = "month"; return null; }
    return { ...b, used: b.used + 1, monthUsed: b.monthUsed + 1 };
  });
  if (!r.ok) return { ok: false, left: 0, reason: reason || "day" };
  return { ok: true, left: Math.max(0, limits.perDay - (r.value as DayMonth).used) };
}

/* ---------- job lock: one generation per key at a time -------------------- */

export type Job = { state: "running" | "failed"; started?: number; at?: number; reason?: unknown };

/** Claims the lock only if it is free or the previous holder's lease expired. */
export async function acquireLock(store: AnyStore, key: string, ttlMs: number): Promise<{ ok: boolean; job: Job | null }> {
  const now = Date.now();
  let seen: Job | null = null;
  const r = await casUpdate<Job>(store, key, cur => {
    seen = cur;
    if (cur?.state === "running" && now - (cur.started || 0) < ttlMs) return null;
    return { state: "running", started: now };
  });
  return { ok: r.ok, job: seen };
}
export async function releaseLock(store: AnyStore, key: string): Promise<void> {
  await store.delete(key).catch(() => {});
}
export async function failLock(store: AnyStore, key: string, reason: unknown): Promise<void> {
  await casUpdate<Job>(store, key, () => ({ state: "failed", at: Date.now(), reason })).catch(() => {});
}
