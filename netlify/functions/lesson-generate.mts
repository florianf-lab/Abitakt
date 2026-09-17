// Background function: generates one lesson with Claude (via Netlify AI Gateway) and stores it in Netlify Blobs.
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { MATHE_TOPICS, LEVELS, type Level, lessonKey, monthKey, SYSTEM_PROMPT, userPrompt,
  EMIT_LESSON_TOOL, validateLesson, cleanLesson, normalizeLesson, REVIEW_PROMPT, REVIEW_TOOL, applyReview } from "../lib/lesson-core.mts";

export default async (req: Request) => {
  const meta = getStore("lesson-meta");
  const secret = await meta.get("secret");
  if (!secret || req.headers.get("x-abitakt-secret") !== secret) return;

  const { topicId, level } = (await req.json().catch(() => ({}))) as { topicId?: string; level?: Level };
  const topicName = topicId && MATHE_TOPICS[topicId];
  if (!topicName || !level || !LEVELS.includes(level)) return;

  const key = lessonKey(topicId!, level);
  const lessons = getStore("lessons");
  const jobs = getStore("lesson-jobs");
  const budget = getStore("budget");
  if (await lessons.get(key)) { await jobs.delete(key); return; }

  const client = new Anthropic();
  const model = process.env.LESSON_MODEL || "claude-sonnet-5";
  let lastErrors: string[] = [];
  let usage = { input: 0, output: 0, calls: 0 };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: [EMIT_LESSON_TOOL as any],
        tool_choice: { type: "tool", name: "emit_lesson" },
        messages: [{
          role: "user",
          content: userPrompt(topicName, level) + (lastErrors.length
            ? `\n\nEin vorheriger Versuch war ungültig. Behebe unbedingt: ${lastErrors.slice(0, 12).join("; ")}. (practice count = es müssen genau 9 Übungsaufgaben sein.)` : ""),
        }],
      }, { signal: AbortSignal.timeout(8 * 60 * 1000) });
      usage.input += msg.usage?.input_tokens || 0;
      usage.output += msg.usage?.output_tokens || 0;
      usage.calls++;
      const block: any = msg.content.find((b: any) => b.type === "tool_use");
      if (block) block.input = normalizeLesson(block.input);
      const errs = block ? validateLesson(block.input) : ["no tool output"];
      if (msg.stop_reason === "max_tokens") errs.push("output truncated");
      if (!errs.length) {
        // second pass: independent review that recomputes every task
        const rv = await client.messages.create({
          model,
          max_tokens: 12000,
          system: REVIEW_PROMPT,
          tools: [REVIEW_TOOL as any],
          tool_choice: { type: "tool", name: "report_review" },
          messages: [{ role: "user", content: `Thema: ${topicName} (${level})\n\n` + JSON.stringify(block.input) }],
        }, { signal: AbortSignal.timeout(6 * 60 * 1000) });
        usage.input += rv.usage?.input_tokens || 0;
        usage.output += rv.usage?.output_tokens || 0;
        usage.calls++;
        const rb: any = rv.content.find((b: any) => b.type === "tool_use");
        const reviewed = applyReview(block.input, rb && rb.input);
        const errs2 = reviewed.ok ? validateLesson(reviewed.lesson) : ["review rejected: " + reviewed.problems.join(" | ")];
        if (reviewed.problems.length) console.log(`lesson ${key} review fixed:`, reviewed.problems.join(" | "));
        if (errs2.length) { lastErrors = errs2; console.warn(`lesson ${key} attempt ${attempt + 1} failed review:`, errs2.join(", ")); continue; }
        await lessons.setJSON(key, { ...cleanLesson(reviewed.lesson, topicName), level, model, reviewed: true,
          reviewNotes: reviewed.problems, created: new Date().toISOString() });
        await jobs.delete(key);
        await record(budget, usage, true);
        return;
      }
      lastErrors = errs;
      console.warn(`lesson ${key} attempt ${attempt + 1} invalid:`, errs.join(", "));
    } catch (e: any) {
      lastErrors = [String(e?.message || e)];
      console.error(`lesson ${key} attempt ${attempt + 1} failed:`, lastErrors[0]);
    }
  }
  await jobs.setJSON(key, { state: "failed", at: Date.now(), reason: lastErrors.slice(0, 5) });
  await record(budget, usage, false);
};

async function record(budget: ReturnType<typeof getStore>, usage: { input: number; output: number; calls: number }, ok: boolean) {
  const k = monthKey();
  const m: any = (await budget.get(k, { type: "json" })) || { generations: 0, failed: 0, inputTokens: 0, outputTokens: 0, calls: 0 };
  if (ok) m.generations++; else m.failed = (m.failed || 0) + 1;
  // failed attempts also cost money – count them against the limit too
  if (!ok && usage.calls) m.generations++;
  m.inputTokens += usage.input; m.outputTokens += usage.output; m.calls += usage.calls;
  await budget.setJSON(k, m);
}

export const config = { path: "/api/lesson-generate", background: true };
