// KI-Lektionen im Client: Laden, Warten, Prüfen, Cachen, Fallback – gegen einen simulierten /api/lesson-Server
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };

function fakeLesson() {
  const mk = (i) => ({
    t: "Schritt " + (i + 1),
    visual: `<div class="visual-box evil"><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#7d6cf6" onload="window.__pwned=1"/></svg><p>Bild zu Schritt ${i + 1} mit genug Text.</p></div>`,
    auditory: `<div class="audio-box"><p>Hör zu, Schritt ${i + 1}: {Who} erklärt es dir.</p></div>`,
    kinesthetic: `<div class="kinetic-box"><p>Probier zuerst selbst, Schritt ${i + 1}.</p></div><img src=x onerror="window.__pwned=1">`,
    textual: `<p>Präzise Definition in Schritt ${i + 1}.</p><script>window.__pwned=1</script>`,
  });
  const q = (i) => ({ d: [0.1, 0.2, 0.35, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9][i], op: "berechnen",
    q: `KI-Frage ${i + 1}: Berechnen Sie x<sup>2</sup> für x = ${i + 1}.`, opts: [String((i + 1) ** 2), String(2 * (i + 1) + 100), String(i + 1000), String((i + 1) ** 3 + 5000)],
    a: String((i + 1) ** 2), why: "Quadrieren heißt mit sich selbst multiplizieren.",
    wrong: { [String(2 * (i + 1) + 100)]: "Verdoppelt statt quadriert." } });
  return { subject: "Mathematik", name: "x", load: 6, ai: true, level: "Leistungsfach",
    steps: [0, 1, 2, 3].map(mk), practice: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(q) };
}

export default async function ({ ok }) {
  let mode = "slow", polls = 0, posts = 0;
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/api/lesson") {
      if (req.method === "POST") posts++; else polls++;
      const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
      if (mode === "budget") return send(429, { status: "budget" });
      if (mode === "fail") return send(200, { status: "failed" });
      if (mode === "slow" && polls < 2) return send(202, { status: "pending" });
      return send(200, { status: "ready", lesson: fakeLesson() });
    }
    const file = join(root, u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
    try { const body = await readFile(file); res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const exe = ["/opt/pw-browsers/chromium"].find(existsSync);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ locale: "de-DE", serviceWorkers: "block" });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  await p.goto(base);
  // plan with Mathe as Leistungsfach
  await p.click('[data-act="quickStart"]');
  for (const k of ["mathe", "biologie", "geschichte"]) await p.click(`[data-act="togLf"][data-v="${k}"]`);
  await p.click('[data-act="setP3"][data-v="deutsch"]');
  await p.click('[data-act="saveAbi"]');
  await p.waitForSelector(".focus-screen");
  await p.evaluate(() => { LOADING = null; ACT.quitSession(); });
  ok(await p.evaluate(() => S.subjects.find(s => s.id === "s_mathe").topics.length) === 7, "Mathe hat 7 Themen");
  ok(await p.evaluate(() => mathLevel("stochastik_binom")) === "Leistungsfach", "Niveau aus P-Tag abgeleitet (LF)");
  ok(await p.evaluate(() => needsAi("analysis_extrem")) === false, "handgeschriebene Lektion wird nie ersetzt");

  // slow generation: loading screen, then lesson
  const start = p.evaluate(() => ACT.openTopic(null, { v: "stochastik_binom" }));
  await p.waitForSelector('[data-act="cancelLoading"]');
  ok(await p.getByText("Lektion wird vorbereitet").count() === 1, "Ladebildschirm erscheint");
  await start;
  await p.waitForSelector('[data-act="nextTeach"]', { timeout: 20000 });
  const st = await p.evaluate(() => ({ ai: SES.topic.ai, gen: !!SES.topic.generic, n: SES.topic.practice.length,
    cached: !!JSON.parse(localStorage.getItem("abitakt.lessons.v2"))["stochastik_binom/Leistungsfach"] }));
  ok(st.ai && !st.gen && st.n === 9, "KI-Lektion geladen (9 Aufgaben)");
  ok(st.cached, "Lektion im eigenen localStorage-Schlüssel gespeichert");
  const html = await p.evaluate(() => JSON.stringify(AI_CACHE["stochastik_binom/Leistungsfach"].steps));
  ok(!/onload|onerror|<script|<img|evil/.test(html), "gefährliches HTML entfernt, fremde Klassen entfernt");
  ok(/visual-box/.test(html) && /<svg/.test(html), "erlaubtes HTML (Klassen, SVG) bleibt");
  ok(await p.getByText("Von KI erstellt").count() === 1, "KI-Hinweis sichtbar");
  // walk the session, answer wrong on purpose once
  await p.click('[data-act="nextTeach"]');
  while (await p.locator('[data-act="nextTeach"]').count()) await p.click('[data-act="nextTeach"]');
  const wrongOpt = await p.evaluate(() => { const q = SES.cur; return Object.keys(q.wrong)[0]; });
  await p.locator(`.opt[data-v="${wrongOpt}"]`).click();
  ok(await p.getByText("Verdoppelt statt quadriert.").count() === 1, "Denkfehler-Hinweis bei falscher Antwort");
  ok(await p.evaluate(() => window.__pwned) === undefined, "kein eingeschleuster Code ausgeführt");
  await p.evaluate(() => ACT.quitSession());

  // cached: no network needed
  const before = posts + polls;
  await p.evaluate(() => ACT.openTopic(null, { v: "stochastik_binom" }));
  await p.waitForSelector('[data-act="nextTeach"]');
  ok(posts + polls === before, "zweiter Aufruf kommt aus dem Cache (kein Serveraufruf)");
  await p.evaluate(() => ACT.quitSession());

  // failure -> placeholder + message
  mode = "fail";
  const snap = await p.evaluate(() => JSON.stringify({ log: S.log, progress: S.progress }));
  await p.evaluate(() => ACT.openTopic(null, { v: "geometrie_lage" }));
  await p.waitForSelector('[data-act="go"][data-v="dash"]');
  ok(await p.evaluate(() => SES === null) && await p.getByText("Noch kein Lerninhalt").count() === 1, "bei Fehler: ehrlicher Hinweis, keine Schein-Übung");
  ok(await p.getByText("gerade nicht verfügbar").count() === 1, "Fehlermeldung angezeigt");
  ok(await p.evaluate(() => JSON.stringify({ log: S.log, progress: S.progress })) === snap, "kein Schein-Fortschritt");
  mode = "budget";
  await p.evaluate(() => ACT.openTopic(null, { v: "geometrie_abstand" }));
  await p.waitForSelector('[data-act="go"][data-v="dash"]');
  ok(await p.getByText("Monatskontingent").count() === 1, "Budget-Hinweis angezeigt");
  await p.evaluate(() => ACT.go(null, { v: "dash" }));

  // cancel while loading
  mode = "slow"; polls = 0;
  const c = p.evaluate(() => ACT.openTopic(null, { v: "analysis_exp" }));
  await p.waitForSelector('[data-act="cancelLoading"]');
  await p.click('[data-act="cancelLoading"]');
  await c;
  await p.waitForTimeout(6000);
  ok(await p.evaluate(() => VIEW === "dash" && !SES), "Abbrechen führt zurück, Session startet nicht nachträglich");

  // profile reset keeps lessons
  await p.evaluate(() => { Store.reset(); });
  ok(await p.evaluate(() => !!localStorage.getItem("abitakt.lessons.v2")), "Profil-Reset löscht Lektionen nicht");
  ok(errors.length === 0, "keine JS-Fehler" + (errors.length ? ": " + errors.join(" | ") : ""));
  await browser.close();
  server.close();
}
