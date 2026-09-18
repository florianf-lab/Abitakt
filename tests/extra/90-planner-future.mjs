// Planung für künftige Tage: Fristen müssen sich auf den geplanten Tag beziehen,
// nicht auf heute. Regression zu einem Befund aus der Codex-Codeprüfung (17.09.2026).
export default async function ({ newPage, ok, act, click }) {
  const { ctx, page: p } = await newPage("de");
  await p.clock.setFixedTime(new Date("2026-09-17T08:00:00"));   // Donnerstag
  await p.reload(); await p.waitForTimeout(200);
  await act(p, "quickStart");
  for (const k of ["mathe", "biologie", "geschichte"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
  await click(p, '[data-act="setP3"][data-v="deutsch"]');
  await act(p, "saveAbi");
  await act(p, "quitSession");

  // Klausur in fünf Tagen, Aufgabe in drei Tagen fällig
  await p.evaluate(() => {
    const l = Coach.life();
    l.events.push({ id: "e1", type: "klausur", subjectId: "s_mathe", date: "2026-09-22", title: "Mathe-Klausur", topics: ["analysis_extrem"], done: false });
    l.tasks.push({ id: "t1", title: "Hausaufgabe Analysis", subjectId: "s_mathe", due: "2026-09-20", minutes: 25, done: false });
    l.week = Array.from({ length: 7 }, () => ({ on: true, from: 14 * 60, to: 20 * 60 }));
    l.budget = 120;
    Store.save();
  });

  const at = (iso) => p.evaluate(d => {
    const c = Coach.candidates(new Date(d + "T08:00:00"));
    return c.map(x => ({ key: x.key, title: x.title, why: (x.why || []).join(" "), minutes: x.minutes }));
  }, iso);

  const today = await at("2026-09-17");
  ok(today.some(x => x.key === "ev:e1:analysis_extrem"), "die Klausur taucht heute als Lernaufgabe auf");
  ok(today.some(x => /in 5 Tagen/.test(x.why)), "heute ist die Klausur in fünf Tagen");
  ok(!today.some(x => x.key === "ev-final:e1"), "heute noch keine Generalprobe");

  const eve = await at("2026-09-21");
  ok(eve.some(x => /morgen/.test(x.why)), "am Vortag heißt es „morgen“, nicht „in 5 Tagen“");

  const examDay = await at("2026-09-22");
  ok(examDay.some(x => x.key === "ev-final:e1" && x.minutes === 10), "am Prüfungstag nur die kurze Aktivierung");
  ok(!examDay.some(x => x.key === "ev:e1:analysis_extrem"), "am Prüfungstag keine neue Lerneinheit mehr");

  const overdue = await at("2026-09-21");
  ok(overdue.some(x => x.key === "task:t1" && /überfällig/.test(x.why)), "die Aufgabe ist am 21.09. überfällig");
  const beforeDue = await at("2026-09-18");
  ok(beforeDue.some(x => x.key === "task:t1" && !/überfällig/.test(x.why)), "am 18.09. ist dieselbe Aufgabe noch nicht überfällig");

  // Zeitschätzung: ohne Belege als grob gekennzeichnet
  ok(await p.evaluate(() => Coach.pace().measured) === false, "ohne genügend Einheiten gilt die Schätzung als grob");
  ok(today.some(x => /Grob geschätzt/.test(x.why)), "der Plan sagt ehrlich, dass die Zeitangabe grob ist");
  ok(await p.evaluate(() => Coach.neededMinutes("analysis_extrem")) > 0, "für ein ungeübtes Thema wird Lernzeit veranschlagt");

  // mit echten Einheiten wird die Schätzung als gemessen geführt
  await p.evaluate(() => {
    const l = Coach.life();
    ["analysis_extrem", "neuro_ap", "gesch_teilung"].forEach((id, k) => {
      for (let i = 0; i < 3; i++) l.sessions.push({ id: "s" + id + i, at: Date.now(), day: "2026-09-1" + (i + 1), hour: 15, key: "topic:" + id, kind: "lesson", topicId: id, minutes: 18, done: true, rating: null });
      S.progress[id] = { mastery: 0.5, attempts: 8, correct: 5, avgMs: 9000, modality: { visual: [1, 2], auditory: [1, 2], kinesthetic: [1, 2], textual: [1, 2] } };
      void k;
    });
    Store.save();
  });
  const paced = await p.evaluate(() => Coach.pace());
  ok(paced.measured === true && paced.unit === 18, "nach echten Einheiten stammt die Länge aus den eigenen Daten");
  ok(await p.evaluate(() => Coach.neededMinutes("geometrie_lage")) > 0, "die gemessene Schätzung liefert weiter sinnvolle Werte");
  await ctx.close();
}
