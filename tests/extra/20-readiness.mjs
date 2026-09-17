// Prüfungsbereitschaft: nur Anzeige, Formel mastery × freshness
export default async function ({ newPage, ok, act, click, runSession }) {
  const { ctx, page: p } = await newPage("de");
  await act(p, "quickStart");
  for (const k of ["mathe", "biologie", "geschichte"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
  await click(p, '[data-act="setP3"][data-v="deutsch"]');
  await act(p, "saveAbi");
  await act(p, "quitSession");
  ok(await p.getByText("Noch keine Übung").count() === 1, "leerer Zustand ohne Übung");
  await runSession(p, "analysis_extrem");
  await p.evaluate(() => ACT.go(null, { v: "dash" }));
  const r = await p.evaluate(() => ({
    last: S.lastPractice.analysis_extrem, fresh: Readiness.freshness("analysis_extrem"),
    rt: Readiness.topic("analysis_extrem"), m: S.progress.analysis_extrem.mastery,
    never: Readiness.topic("stochastik_binom"), gaps: Readiness.gaps(3).map(g => g.id)
  }));
  ok(r.last > 0 && r.fresh === 1, "letzte Übung gespeichert, heute = frisch");
  ok(Math.abs(r.rt - r.m) < 1e-9, "Bereitschaft = Stand bei frischem Wissen");
  ok(r.never === 0 && r.gaps.length === 3 && !r.gaps.includes("analysis_extrem"), "Lücken-Liste zeigt ungeübte Themen");
  const old = await p.evaluate(() => { S.lastPractice.analysis_extrem = Date.now() - 21 * 864e5; return Readiness.freshness("analysis_extrem"); });
  ok(Math.abs(old - 0.5) < 0.01, "nach 21 Tagen halbe Frische");
  const floor = await p.evaluate(() => { S.lastPractice.analysis_extrem = Date.now() - 400 * 864e5; return Readiness.freshness("analysis_extrem"); });
  ok(floor === 0.35, "Frische fällt nie unter 0,35");
  // Backfill aus altem Log
  const bf = await p.evaluate(() => { S.lastPractice = {}; backfillLastPractice(); return !!S.lastPractice.analysis_extrem; });
  ok(bf, "alte Profile: letzte Übung aus dem Protokoll ergänzt");
  await p.evaluate(() => render());
  ok(await p.getByText("Prüfungsbereitschaft").count() >= 1, "Karte im Dashboard sichtbar");
  ok(p.errors.length === 0, "keine JS-Fehler" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
  await ctx.close();
}
