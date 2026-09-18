// Freitext-Aufgaben mit KI-Korrektur und der mündliche Prüfungstrainer – gegen simulierte
// /api/open-, /api/feedback- und /api/oral-Endpunkte.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };

const TASKS = [
  { op: "berechnen", afb: 1, minutes: 6, q: "Berechnen Sie den Hochpunkt der Funktion f mit f(x) = -x^2 + 4x + 1 und geben Sie ihn an.",
    expect: [{ t: "Erste Ableitung gebildet", p: 1 }, { t: "Nullstelle der Ableitung bestimmt", p: 2 }, { t: "Hochpunkt angegeben", p: 1 }],
    solution: "f'(x) = -2x + 4, also x = 2. f(2) = 5, der Hochpunkt ist H(2|5). Wegen f''(x) = -2 < 0 liegt ein Maximum vor." },
  { op: "erläutern", afb: 2, minutes: 10, q: "Erläutern Sie, warum die notwendige Bedingung f'(x) = 0 allein nicht für einen Extrempunkt ausreicht.",
    expect: [{ t: "Sattelpunkt als Gegenbeispiel", p: 2 }, { t: "hinreichende Bedingung genannt", p: 2 }, { t: "Beispiel durchgerechnet", p: 1 }],
    solution: "Bei f(x) = x^3 ist f'(0) = 0, es liegt aber ein Sattelpunkt vor. Erst ein Vorzeichenwechsel von f' oder f''(x) ungleich 0 sichert einen Extrempunkt." },
  { op: "beurteilen", afb: 3, minutes: 14, q: "Beurteilen Sie, ob ein randnaher Punkt eines abgeschlossenen Intervalls ein globales Maximum sein kann, und begründen Sie Ihre Einschätzung.",
    expect: [{ t: "Randwerte müssen geprüft werden", p: 2 }, { t: "Unterschied lokal/global", p: 2 }, { t: "Beispiel oder Begründung", p: 2 }],
    solution: "Auf einem abgeschlossenen Intervall nimmt eine stetige Funktion ihr Maximum an, das kann auch am Rand liegen. Deshalb vergleicht man Funktionswerte an den Extremstellen mit denen an den Rändern." },
];
const FEEDBACK = {
  points: 3, max: 4,
  criteria: [{ t: "Erste Ableitung gebildet", p: 1, hit: true, quote: "f'(x) = -2x + 4" },
             { t: "Nullstelle der Ableitung bestimmt", p: 2, hit: true, quote: "x = 2" },
             { t: "Hochpunkt angegeben", p: 1, hit: false, quote: "" }],
  operator: "Der Operator „berechnen“ ist erfüllt, der Rechenweg steht da.",
  good: "Die Ableitung ist richtig gebildet und sauber nach x aufgelöst.",
  improve: ["Der Punkt fehlt: gib H(2|5) explizit an.", "Prüfe mit f'' , ob es wirklich ein Maximum ist."],
  next: "Übe das Angeben vollständiger Punkte statt nur der x-Stelle.",
  solution: TASKS[0].solution,
};
const turn = (i) => i < 5
  ? { say: `Frage ${i + 1}: Was verstehen Sie unter einem Extrempunkt?`, note: "ok", done: false, grade: null, strengths: [], gaps: [], index: i + 1, total: 5 }
  : { say: "Insgesamt hast du die Begriffe sicher benutzt und sauber begründet.", note: "", done: true, grade: 11,
      strengths: ["Fachsprache sitzt", "gute Beispiele"], gaps: ["Randwerte vergessen"], index: 6, total: 5 };

export default async function ({ ok }) {
  let openMode = "slow", fbMode = "ok", oralMode = "ok", openPosts = 0, openPolls = 0, fbCalls = 0, oralCalls = 0;
  let lastFeedbackBody = null;
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
    const bodyOf = async () => JSON.parse(await new Promise(r => { let s = ""; req.on("data", c => s += c); req.on("end", () => r(s || "{}")); }));
    if (u.pathname === "/api/open") {
      if (req.method === "POST") { await bodyOf(); openPosts++; } else openPolls++;
      if (openMode === "budget") return send(429, { status: "budget" });
      if (openMode === "fail") return send(200, { status: "failed" });
      if (openMode === "slow" && openPolls < 1) return send(202, { status: "pending" });
      return send(200, { status: "ready", tasks: TASKS });
    }
    if (u.pathname === "/api/feedback") {
      lastFeedbackBody = await bodyOf(); fbCalls++;
      if (fbMode === "budget") return send(429, { status: "budget" });
      if (fbMode === "fail") return send(502, { error: "failed" });
      const t = TASKS[lastFeedbackBody.taskIndex] || TASKS[0];
      return send(200, { status: "ready", left: 24, feedback: Object.assign({}, FEEDBACK, {
        criteria: t.expect.map((e, i) => ({ t: e.t, p: e.p, hit: i < 2, quote: i < 2 ? "Zitat " + (i + 1) : "" })),
        points: t.expect.slice(0, 2).reduce((n, e) => n + e.p, 0), max: t.expect.reduce((n, e) => n + e.p, 0), solution: t.solution }) });
    }
    if (u.pathname === "/api/oral") {
      const b = await bodyOf(); oralCalls++;
      if (oralMode === "budget") return send(429, { status: "budget" });
      if (oralMode === "fail") return send(502, { error: "failed" });
      return send(200, { status: "ready", left: 29, turn: turn(b.history.length) });
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
  await p.click('[data-act="quickStart"]');
  for (const k of ["mathe", "biologie", "englisch"]) await p.click(`[data-act="togLf"][data-v="${k}"]`);
  await p.click('[data-act="setP3"][data-v="deutsch"]');
  await p.click('[data-act="togOral"][data-v="geschichte"]');
  await p.click('[data-act="saveAbi"]');
  await p.waitForSelector(".focus-screen");
  await p.evaluate(() => { LOADING = null; ACT.quitSession(); });

  ok(await p.evaluate(() => openLevel("analysis_extrem")) === "Leistungsfach", "Niveau aus dem P-Tag (Mathe = P1)");
  ok(await p.evaluate(() => openLevel("gesch_teilung")) === "Basisfach", "mündliches Fach zählt als Basisfach");
  ok(await p.evaluate(() => canOpen("lyrik")) === false, "Themen ohne Aufgaben-Unterstützung bleiben aus");

  // dashboard card
  ok(await p.locator('[data-act="startOpen"]').count() > 0, "Prüfungsformat-Karte im Dashboard");
  ok(await p.locator('[data-act="startOral"][data-v="gesch_teilung"]').count() === 1, "mündlicher Trainer nur bei P4/P5");
  ok(await p.locator('[data-act="startOral"][data-v="analysis_extrem"]').count() === 0, "kein mündlicher Trainer bei schriftlichen Fächern");
  const shown = await p.locator('[data-act="startOpen"]').evaluateAll(els => els.map(e => e.dataset.v));
  ok(new Set(shown.map(id => id.split("_")[0])).size >= 2, "Karte mischt mehrere Fächer");

  // slow generation -> loading -> task
  const started = p.evaluate(() => ACT.startOpen(null, { v: "analysis_extrem" }));
  await p.waitForSelector("#op-answer", { timeout: 25000 });
  await started;
  ok(await p.evaluate(() => OPEN.task.afb) === 1, "erste Aufgabe ist AFB 1");
  ok(await p.getByText("Berechnen Sie den Hochpunkt", { exact: false }).count() === 1, "Aufgabentext sichtbar");
  ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem("abitakt.open.v1"))["analysis_extrem/Leistungsfach"]), "Aufgaben lokal gespeichert");

  // too short
  await p.fill("#op-answer", "hm");
  await p.click('[data-act="openSubmit"]');
  ok(fbCalls === 0 && await p.locator("#op-answer").count() === 1, "zu kurze Antwort wird nicht abgeschickt");

  const progressBefore = await p.evaluate(() => JSON.stringify(S.progress));
  // grading
  await p.fill("#op-answer", "f'(x) = -2x + 4, also x = 2. Damit liegt die Extremstelle bei x = 2.");
  await p.click('[data-act="openSubmit"]');
  await p.waitForSelector('[data-act="openNext"]', { timeout: 20000 });
  ok(lastFeedbackBody.taskIndex === 0 && lastFeedbackBody.level === "Leistungsfach", "Korrektur fragt die richtige Aufgabe an");
  ok(await p.getByText("3 / 4").count() >= 0 && await p.evaluate(() => OPEN.feedback.points) === 3, "Punkte aus der Korrektur übernommen");
  ok(await p.getByText("Zitat 1").count() === 1, "Belegzitat aus der Antwort angezeigt");
  ok(await p.getByText("Der Punkt fehlt", { exact: false }).count() === 1, "konkreter Verbesserungshinweis angezeigt");
  ok(await p.getByText("Wegen f''(x) = -2", { exact: false }).count() === 1, "Musterlösung verfügbar");
  const stats = await p.evaluate(() => JSON.parse(JSON.stringify(S.openStats.analysis_extrem)));
  ok(stats.done === 1 && stats.points === 3 && stats.max === 4 && stats.next === 1, "Statistik gespeichert, nächste Aufgabe vorgemerkt");
  ok(await p.evaluate(() => !!S.lastPractice.analysis_extrem), "zählt als Übung für die Prüfungsbereitschaft");
  ok(await p.evaluate(() => Coach.life().sessions.some(s => s.kind === "open" && s.done)), "Einheit im Lernprotokoll des Coaches");
  ok(await p.evaluate(() => JSON.stringify(S.progress)) === progressBefore, "Freitext verändert die Engine-Mastery nicht");

  // next task continues where we left off
  await p.click('[data-act="openNext"]');
  await p.waitForSelector("#op-answer");
  ok(await p.evaluate(() => OPEN.idx) === 1, "nächste Aufgabe ist Aufgabe 2");
  await p.click('[data-act="openSkip"]');
  ok(await p.evaluate(() => OPEN.task.afb) === 3, "Überspringen führt zur nächsten Aufgabe");

  // marking fails: text survives
  fbMode = "fail";
  await p.fill("#op-answer", "Eine ausführliche Antwort, die nicht verloren gehen darf.");
  await p.click('[data-act="openSubmit"]');
  await p.waitForSelector('[data-act="openSubmit"]', { timeout: 20000 });
  await p.waitForFunction(() => document.getElementById("op-answer") && document.getElementById("op-answer").value.length > 10, null, { timeout: 10000 });
  ok(await p.inputValue("#op-answer").then(v => v.startsWith("Eine ausführliche")), "bei Fehler bleibt der geschriebene Text erhalten");
  ok(await p.getByText("nicht geklappt", { exact: false }).count() === 1, "ehrliche Fehlermeldung");
  fbMode = "budget";
  await p.click('[data-act="openSubmit"]');
  await p.waitForFunction(() => document.body.innerText.includes("Kontingent"), null, { timeout: 15000 });
  ok(true, "Budget-Hinweis bei erschöpftem Tageskontingent");
  fbMode = "ok";
  await p.evaluate(() => ACT.openQuit());
  await p.waitForSelector('[data-act="startOpen"]');

  // cached: no more generation calls
  const posts = openPosts;
  await p.evaluate(() => ACT.startOpen(null, { v: "analysis_extrem" }));
  await p.waitForSelector("#op-answer");
  ok(openPosts === posts, "zweiter Aufruf kommt aus dem Cache");
  await p.evaluate(() => ACT.openQuit());

  // generation failure
  openMode = "fail";
  await p.evaluate(() => ACT.startOpen(null, { v: "neuro_ap" }));
  await p.waitForFunction(() => VIEW === "dash" && !OPEN, null, { timeout: 20000 });
  ok(await p.getByText("nicht erstellt werden", { exact: false }).count() === 1, "Fehler bei der Aufgabenerstellung wird ehrlich gemeldet");
  openMode = "ready";

  // oral trainer
  await p.waitForSelector('[data-act="startOral"][data-v="gesch_teilung"]');
  await p.evaluate(() => ACT.startOral(null, { v: "gesch_teilung" }));
  await p.waitForSelector("#or-answer", { timeout: 20000 });
  ok(await p.getByText("Frage 1 von 5").count() === 1, "mündliche Prüfung startet mit Frage 1");
  for (let i = 0; i < 5; i++) {
    await p.fill("#or-answer", "Eine ausformulierte Antwort zur Frage Nummer " + (i + 1) + ".");
    await p.click('[data-act="oralSend"]');
    if (i < 4) await p.waitForFunction(n => ORAL && ORAL.history.length === n, i + 1, { timeout: 20000 });
  }
  await p.waitForSelector('[data-act="oralAgain"]', { timeout: 20000 });
  ok(oralCalls === 6, "fünf Fragen plus Abschlussrückmeldung");
  ok(await p.getByText("11 Notenpunkte", { exact: false }).count() === 1, "Notenpunkte als Übungseinschätzung");
  ok(await p.getByText("Randwerte vergessen").count() === 1, "Lücken werden benannt");
  ok(await p.evaluate(() => Coach.life().sessions.some(s => s.kind === "oral" && s.done)), "mündliche Übung im Lernprotokoll");
  await p.evaluate(() => document.querySelectorAll("details").forEach(d => d.open = true));
  ok(await p.evaluate(() => document.body.innerText.includes("Antwort zur Frage Nummer 3")), "Gesprächsprotokoll nachlesbar");
  await p.evaluate(() => ACT.oralDone());

  // oral failure at the start returns to the dashboard
  oralMode = "fail";
  await p.evaluate(() => ACT.startOral(null, { v: "gesch_teilung" }));
  await p.waitForFunction(() => VIEW === "dash" && !ORAL, null, { timeout: 20000 });
  ok(await p.getByText("abgerissen", { exact: false }).count() === 1, "Verbindungsfehler wird gemeldet");
  oralMode = "ok";

  // other languages keep every string translated
  for (const lang of ["en", "tr"]) {
    await p.evaluate(l => { ACT.setLang(null, { v: l }); }, lang);
    await p.evaluate(() => ACT.startOpen(null, { v: "analysis_extrem" }));
    await p.waitForSelector("#op-answer");
    const txt = await p.evaluate(() => document.body.innerText);
    ok(!/\bop_[a-z_]+|\bor_[a-z_]+/.test(txt), `[${lang}] keine fehlenden Übersetzungen`);
    await p.evaluate(() => ACT.openQuit());
  }
  await p.evaluate(() => ACT.setLang(null, { v: "de" }));

  // profile reset keeps the generated tasks
  await p.evaluate(() => { Store.reset(); });
  ok(await p.evaluate(() => !!localStorage.getItem("abitakt.open.v1")), "Profil-Reset löscht die Aufgaben nicht");
  ok(errors.length === 0, "keine JS-Fehler" + (errors.length ? ": " + errors.join(" | ") : ""));
  await browser.close();
  server.close();
}
