// Lernbegleiter: Alltag einrichten, Tagesplan mit Begründung, Check-in, Fokus-Timer, Aufgaben, Beobachtungen
export default async function ({ newPage, ok, act, click }) {
  const { ctx, page: p } = await newPage("de");
  await p.clock.setFixedTime(new Date("2026-09-17T08:00:00"));       // Donnerstag, 8 Uhr
  await p.reload(); await p.waitForTimeout(200);
  await act(p, "quickStart");
  for (const k of ["mathe", "biologie", "geschichte"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
  await click(p, '[data-act="setP3"][data-v="deutsch"]');
  await act(p, "saveAbi");
  await act(p, "quitSession");
  ok(await p.locator('[data-act="coachSetup"]').count() >= 1, "Einladung „Alltag einrichten“ sichtbar");
  ok(await p.getByText("Dein nächster Schritt").count() === 1, "nächster Schritt auch ohne Einrichtung");

  // Wizard 1: Ziele + Verhalten
  await click(p, '[data-act="coachSetup"]');
  await p.fill("#g-avg", "1,7"); await p.fill("#g-study", "Medizin"); await p.fill("#g-why", "Ich will Ärztin werden.");
  await p.fill("#gt-s_mathe", "14");
  await click(p, '[data-act="habScale"][data-k="procrastination"][data-v="5"]');
  await click(p, '[data-act="habScale"][data-k="phone"][data-v="5"]');
  await p.selectOption("#h-len", "20");
  await p.fill("#h-place", "in der Bibliothek"); await p.fill("#h-starter", "Tee kochen");
  await act(p, "aboutSave");
  // Wizard 2: Woche
  for (let i = 0; i < 7; i++) { await p.check("#w-on-" + i); await p.fill("#w-from-" + i, "14:00"); await p.fill("#w-to-" + i, "20:00"); }
  await p.fill("#w-budget", "90");
  await p.selectOption("#tt-day", "3");
  await p.fill("#tt-label", "Fußballtraining"); await p.fill("#tt-from", "16:00"); await p.fill("#tt-to", "17:30");
  await p.selectOption("#tt-kind", "other");
  await act(p, "ttAdd");
  ok(await p.getByText("16:00–17:30 · Fußballtraining").count() === 1, "fester Termin eingetragen");
  await act(p, "winSave");
  // Wizard 3: Prüfung morgen
  await p.selectOption("#ev-type", "klausur");
  await p.selectOption("#ev-subject", "s_mathe");
  await p.fill("#ev-date", "2026-09-18");
  await p.fill("#ev-title", "Mathe-Klausur");
  await click(p, '[data-act="evTopic"][data-v="analysis_extrem"]');
  await act(p, "evAddWiz");
  ok(await p.getByText("Mathe-Klausur").count() >= 1, "Klausur eingetragen");
  await act(p, "wizFinish");

  const plan = await p.evaluate(() => { const pl = Coach.plan(); return { items: pl.items.map(i => ({ key: i.key, kind: i.kind, m: i.minutes, s: i.start, e: i.end, why: i.why.join(" "), title: i.title })), timed: pl.timed }; });
  const first = plan.items[0];
  ok(plan.timed && plan.items.length >= 2, `Tagesplan mit Uhrzeiten (${plan.items.length} Einheiten)`);
  ok(/^ev:/.test(first.key) && /morgen/.test(first.why) && /Generalprobe/.test(first.title), "Klausur morgen steht ganz oben, mit Begründung");
  ok(first.m <= 10, `Einstieg klein wegen Aufschieben (${first.m} Min)`);
  ok(plan.items.every(i => i.s >= 14 * 60 && i.e <= 20 * 60), "alles in den Lernzeiten");
  ok(plan.items.every(i => i.e <= 16 * 60 || i.s >= 17.5 * 60), "Training wird ausgespart");
  ok(plan.items.every((i, k) => k === 0 || i.s >= plan.items[k - 1].e + 10), "Pausen zwischen Einheiten");
  ok(plan.items.reduce((n, i) => n + i.m, 0) <= 90, "Tagesbudget eingehalten");
  ok(plan.items.slice(1).every(i => i.m <= 20), "Länge passt zur Angabe (20 Min)");
  await p.evaluate(() => render());
  ok(await p.getByText("Plan für den Einstieg").count() === 1 && await p.getByText("in der Bibliothek").count() >= 1, "Wenn-Dann-Plan fürs Anfangen");
  ok(await p.getByText("Tee kochen").count() >= 1, "Startritual angezeigt");
  ok(await p.getByText("Fußballtraining").count() === 1, "Termin in der Tagesübersicht");

  // Check-in: wenig Energie + zu viel -> kürzer
  await click(p, '[data-act="ciEnergy"][data-v="1"]');
  await click(p, '[data-act="ciBarrier"][data-v="overload"]');
  await act(p, "ciSave");
  const low = await p.evaluate(() => { const pl = Coach.plan(); return { max: Math.max(...pl.items.map(i => i.minutes)), sum: pl.items.reduce((n, i) => n + i.minutes, 0), notes: pl.notes }; });
  ok(low.max <= 15 && low.sum <= 54 && low.notes.includes("co_adapt_energy"), `Check-in verkürzt den Plan (max ${low.max}, Summe ${low.sum})`);
  ok(await p.locator('[data-act="ciSave"]').count() === 0, "Check-in nur einmal pro Tag");

  // Start des ersten Schritts -> echte Lektion (analysis_extrem ist verfügbar)
  await click(p, '.coach-hero [data-act="coachStart"]');
  ok(await p.locator(".focus-card").count() === 1 && await p.evaluate(() => SES && SES.topicId === "analysis_extrem"), "Start öffnet die passende Lektion");
  for (let g = 0; g < 30; g++) {
    if (await p.locator('[data-act="nextTeach"]').count()) { await act(p, "nextTeach"); continue; }
    if (await p.locator('.opt[data-act="ansPractice"]').count()) { await p.locator('.opt[data-act="ansPractice"]').first().click(); await p.waitForTimeout(2800); continue; }
    break;
  }
  ok(await p.locator('[data-act="coachRate"]').count() === 3, "Bewertung nach der Einheit");
  await click(p, '[data-act="coachRate"][data-v="hard"]');
  const rec = await p.evaluate(() => Coach.life().sessions.slice(-1)[0]);
  ok(rec.done && rec.kind === "lesson" && rec.rating === "hard" && /^ev:/.test(rec.key), "Einheit mit Plan-Bezug und Bewertung gespeichert");
  await p.evaluate(() => ACT.go(null, { v: "dash" }));
  const after = await p.evaluate(k => { const it = Coach.plan().items.find(i => i.key === k); const spent = Coach.life().sessions.filter(s => s.key === k).reduce((n, s) => n + s.minutes, 0); return { m: it ? it.minutes : 0, spent }; }, rec.key);
  ok(after.m > 0 && after.m <= 30 - after.spent + 0.5, `Klausur-Vorbereitung: nur noch der Rest der Tagesdosis (${after.m} Min)`);
  await p.evaluate(k => { const l = Coach.life(); l.sessions.push({ id: "fill", at: Date.now(), day: isoDay(), key: k, minutes: 30, done: true, kind: "lesson" }); }, rec.key);
  ok(await p.evaluate(k => !Coach.plan().items.some(i => i.key === k), rec.key), "Tagesdosis erledigt -> fällt aus dem Plan");
  await p.evaluate(() => { const l = Coach.life(); l.sessions = l.sessions.filter(s => s.id !== "fill"); });

  // Aufgabe mit Fokus-Timer
  await click(p, '[data-act="go"][data-v="plan"]');
  await click(p, '[data-act="planTab"][data-v="tasks"]');
  await p.fill("#tk-title", "Arbeitsblatt Genetik");
  await p.selectOption("#tk-subject", "s_biologie");
  await p.fill("#tk-due", "2026-09-17");
  await p.fill("#tk-min", "15");
  await act(p, "tkAdd");
  ok(await p.getByText("Arbeitsblatt Genetik").count() >= 1, "Aufgabe eingetragen");
  const ti = await p.evaluate(() => { TODAY_PLAN = Coach.plan(); return TODAY_PLAN.items.findIndex(i => i.kind === "task"); });
  ok(ti >= 0, "Aufgabe (heute fällig) im Tagesplan");
  await p.evaluate(i => ACT.coachStart(null, { i: String(i) }), ti);
  ok(await p.locator("#fclock").count() === 1, "Fokus-Timer läuft");
  await p.clock.setFixedTime(new Date("2026-09-17T08:12:00"));
  await p.waitForTimeout(1200);
  const clockTxt = await p.locator("#fclock").textContent();
  ok(/^0?[0-3]:\d\d$/.test(clockTxt), `Timer zählt herunter (${clockTxt})`);
  await act(p, "focusToggle");
  ok(await p.getByText("Weiter").count() >= 1, "Pause möglich");
  await act(p, "focusDone");
  await act(p, "focusTaskDone");
  const task = await p.evaluate(() => Coach.life().tasks[0]);
  ok(task.done && task.spent >= 11, `Aufgabe erledigt, Zeit erfasst (${task.spent} Min)`);

  // Einheit mit eigenen Unterlagen abbrechen -> als abgebrochen gezählt, kein Fachfortschritt
  const progBefore = await p.evaluate(() => JSON.stringify(S.progress));
  await p.evaluate(() => startFocus({ title: "Lyrikanalyse", minutes: 20, kind: "external", topicId: "lyrik" }));
  await p.clock.setFixedTime(new Date("2026-09-17T08:20:00"));
  await act(p, "focusQuit");
  const last = await p.evaluate(() => Coach.life().sessions.slice(-1)[0]);
  ok(last.done === false && last.minutes >= 7, "Abbruch mit Zeit protokolliert");
  ok(await p.evaluate(() => JSON.stringify(S.progress)) === progBefore, "eigene Unterlagen erzeugen keinen Schein-Fortschritt");

  // Beobachtungen
  await p.evaluate(() => { const l = Coach.life(); for (let i = 0; i < 3; i++) l.sessions.push({ id: "x" + i, at: Date.now(), day: isoDay(), minutes: 5, done: false, kind: "lesson" }); });
  const st = await p.evaluate(() => { const s = Coach.stats(); return { abandon: s.abandon, cap: Coach.unitCap().cap }; });
  ok(st.abandon && st.cap <= 15, "viele Abbrüche -> kürzere Einheiten");
  await click(p, '[data-act="go"][data-v="prof"]');
  ok(await p.getByText("Was abitakt über dich gelernt hat").count() === 1 && await p.getByText("abgebrochene").count() >= 1, "Beobachtungen im Profil");
  ok(await p.getByText("Ich will Ärztin werden.").count() >= 1, "dein Warum wird angezeigt");

  // Planer: alle Tabs in allen Sprachen, mobil ohne Überlauf
  for (const lang of ["de", "en", "tr"]) {
    await click(p, `[data-act="setLang"][data-v="${lang}"]`);
    await p.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["events", "tasks", "week", "topics"]) {
      await click(p, '[data-act="go"][data-v="plan"]');
      await click(p, `[data-act="planTab"][data-v="${tab}"]`);
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `[${lang}] Planer „${tab}“ passt mobil`);
    }
    await click(p, '[data-act="go"][data-v="dash"]');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `[${lang}] Tagesplan passt mobil`);
    ok(!/\bco_[a-z_]+/.test(await p.evaluate(() => document.body.innerText)), `[${lang}] keine fehlenden Übersetzungen`);
  }
  // Unterricht: „abgeschlossen“ fällt aus dem Plan
  await p.evaluate(() => { Coach.life().curriculum.stochastik_binom = "done"; });
  ok(await p.evaluate(() => !Coach.candidates().some(c => c.topicId === "stochastik_binom")), "abgeschlossene Themen werden nicht eingeplant");
  // Prüfungstag: nur kurze Aktivierung
  await p.clock.setFixedTime(new Date("2026-09-18T07:00:00"));
  const examDay = await p.evaluate(() => Coach.candidates()[0]);
  ok(examDay.kind === "review" && examDay.minutes === 10, "am Prüfungstag nur 10 Min Aktivierung");
  ok(p.errors.length === 0, "keine JS-Fehler" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
  await ctx.close();
}
