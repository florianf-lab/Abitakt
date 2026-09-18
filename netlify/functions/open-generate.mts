// Background: writes three free-text exam tasks (with expected-answer guide) for one topic.
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { LEVELS, type Level } from "../lib/lesson-core.mts";
import { topicInfo, openKey, OPEN_PROMPT, EMIT_OPEN_TOOL, validateOpen, cleanOpen } from "../lib/ai-core.mts";
import { recordOutcome, releaseSlot, releaseLock, failLock } from "../lib/atomic.mts";

const budgetKey = () => "open-" + new Date().toISOString().slice(0, 7);
const HARD_DEADLINE_MS = 13 * 60 * 1000, GEN_TIMEOUT_MS = 5 * 60 * 1000;

export default async (req: Request) => {
  const meta = getStore("lesson-meta");
  const secret = await meta.get("secret", { type: "text" });
  if (!secret || req.headers.get("x-abitakt-secret") !== secret) return;

  const { topicId, level } = (await req.json().catch(() => ({}))) as { topicId?: string; level?: Level };
  const info = topicId ? topicInfo(topicId) : null;
  if (!info || !level || !LEVELS.includes(level)) return;

  const key = openKey(topicId!, level);
  const store = getStore("open-tasks"), jobs = getStore("open-jobs"), budget = getStore("budget");
  if (await store.get(key)) { await releaseLock(jobs as any, key); await releaseSlot(budget as any, budgetKey()); return; }

  const deadline = Date.now() + HARD_DEADLINE_MS;
  const usage = { input: 0, output: 0, calls: 0 };

  const client = new Anthropic();
  const model = process.env.LESSON_MODEL || "claude-sonnet-5";
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && Date.now() + GEN_TIMEOUT_MS > deadline) { lastErrors = ["no time left for a second attempt"]; break; }
    try {
      const msg = await client.messages.create({
        model, max_tokens: 6000, system: OPEN_PROMPT,
        tools: [EMIT_OPEN_TOOL as any], tool_choice: { type: "tool", name: "emit_open" },
        messages: [{ role: "user", content: `Fach: ${info.subject}\nThema: ${info.name}\nNiveau: ${level} (Baden-Württemberg, Kursstufe, Abitur 2027)`
          + (lastErrors.length ? `\n\nEin vorheriger Versuch war ungültig. Behebe: ${lastErrors.slice(0, 8).join("; ")}.` : "") }],
      }, { signal: AbortSignal.timeout(Math.min(GEN_TIMEOUT_MS, Math.max(30_000, deadline - Date.now()))) });
      usage.input += msg.usage?.input_tokens || 0; usage.output += msg.usage?.output_tokens || 0; usage.calls++;
      const block: any = msg.content.find((b: any) => b.type === "tool_use");
      const errs = block ? validateOpen(block.input) : ["no tool output"];
      if (!errs.length) {
        await store.setJSON(key, { ...cleanOpen(block.input), subject: info.subject, topic: info.name, level, model, created: new Date().toISOString() });
        await releaseLock(jobs as any, key);
        await recordOutcome(budget as any, budgetKey(), usage, true);
        return;
      }
      lastErrors = errs;
      console.warn(`open ${key} attempt ${attempt + 1} invalid:`, errs.join(", "));
    } catch (e: any) {
      lastErrors = [String(e?.message || e)];
      console.error(`open ${key} attempt ${attempt + 1} failed:`, lastErrors[0]);
    }
  }
  await failLock(jobs as any, key, lastErrors.slice(0, 3));
  if (!usage.calls) await releaseSlot(budget as any, budgetKey());
  await recordOutcome(budget as any, budgetKey(), usage, false);
};
export const config = { path: "/api/open-generate", background: true };
