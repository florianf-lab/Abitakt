// Stolpersteine: falsche Antworten werden gesammelt, lassen sich gezielt nachüben
// und verschwinden erst nach zwei richtigen Antworten in Folge.
export default async function ({ newPage, ok, act, click }) {
  const { ctx, page: p } = await newPage("de");
  await act(p, "quickStart");
  for (const k of ["mathe", "biologie", "deutsch"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
  await click(p, '[data-act="setP3"][data-v="geschichte"]');
  await act(p, "saveAbi");
  await act(p, "quitSession");

  ok(await p.evaluate(() => Array.isArray(S.misses) && S.misses.length === 0), "am Anfang ist die Liste leer");
  ok((await p.evaluate(() => document.body.innerText)).includes("Stolpersteine") === false, "ohne Fehler keine Karte im Dashboard");

  // eine Lektion öffnen und absichtlich falsch antworten
  const wrongOnce = async (topic) => {
    await p.evaluate(t => ACT.openTopic(null, { v: t }), topic);
    await p.waitForSelector('[data-act="nextTeach"]');
    while (await p.locator('[data-act="nextTeach"]').count()) await p.click('[data-act="nextTeach"]');
    await p.waitForSelector(".opt");
    const q = await p.evaluate(() => ({ q: SES.cur.q, a: SES.cur.a, opts: SES.cur.opts }));
    const wrong = q.opts.find(o => o !== q.a);
    await p.locator(`.opt[data-v="${wrong.replace(/"/g, '\\"')}"]`).click();
    await p.waitForTimeout(300);
    await p.evaluate(() => ACT.quitSession());
    return { q, wrong };
  };
  const first = await wrongOnce("genetik_pbs");
  const stored = await p.evaluate(() => JSON.parse(JSON.stringify(S.misses)));
  ok(stored.length === 1, "die falsche Antwort ist gespeichert");
  ok(stored[0].q === first.q.q && stored[0].a === first.q.a && stored[0].chosen === first.wrong, "Frage, richtige Antwort und eigene Antwort sind festgehalten");
  ok(stored[0].topicId === "genetik_pbs" && stored[0].n === 1 && stored[0].streak === 0, "Thema, Anzahl und Serie stimmen");
  ok(!!stored[0].why, "die Erklärung ist mitgespeichert");

  await wrongOnce("eroerterung");
  ok(await p.evaluate(() => S.misses.length) === 2, "ein zweiter Fehler aus einem anderen Fach kommt dazu");

  // Dashboard-Karte und eigene Ansicht
  await p.evaluate(() => { VIEW = "dash"; render(); });
  ok(await p.locator('[data-act="startDrill"][data-v="all"]').count() >= 1, "Dashboard bietet den Drill an");
  await p.evaluate(() => ACT.go(null, { v: "miss" }));
  const listTxt = await p.evaluate(() => document.body.innerText);
  ok(listTxt.includes("Deine Antwort") && listTxt.includes("Richtig wäre"), "die Liste zeigt eigene und richtige Antwort");
  ok(/genetik: proteinbiosynthese/i.test(listTxt) && /erörterung literarischer texte/i.test(listTxt), "nach Themen gruppiert");

  // Drill: einmal richtig -> Serie 1, bleibt in der Liste
  const answerDrill = async (right) => {
    await p.waitForSelector(".opt[data-act='drillAns']");
    const cur = await p.evaluate(() => ({ a: DRILL.queue[DRILL.pos].a, opts: DRILL.queue[DRILL.pos].opts }));
    const pickV = right ? cur.a : cur.opts.find(o => o !== cur.a);
    await p.locator(`.opt[data-v="${pickV.replace(/"/g, '\\"')}"]`).click();
    await p.waitForTimeout(right ? 1600 : 2800);
  };
  await p.evaluate(() => ACT.startDrill(null, { v: "genetik_pbs" }));
  await answerDrill(true);
  await p.waitForSelector('[data-act="drillDone"]');
  ok(await p.evaluate(() => S.misses.find(m => m.topicId === "genetik_pbs").streak) === 1, "eine richtige Antwort setzt die Serie auf 1");
  ok(await p.evaluate(() => S.misses.length) === 2, "nach einer richtigen Antwort bleibt der Stolperstein noch");
  const noMastery = await p.evaluate(() => JSON.stringify(S.progress.genetik_pbs));
  await p.evaluate(() => ACT.drillDone());

  // zweite richtige Antwort -> gelöst
  await p.evaluate(() => ACT.startDrill(null, { v: "genetik_pbs" }));
  await answerDrill(true);
  await p.waitForSelector('[data-act="drillDone"]');
  ok(await p.evaluate(() => S.misses.length) === 1, "zweimal richtig in Folge löst den Stolperstein");
  ok(await p.evaluate(() => JSON.stringify(S.progress.genetik_pbs)) === noMastery, "der Drill verändert den fachlichen Stand nicht");
  ok(await p.evaluate(() => Coach.life().sessions.some(s => s.kind === "review" && s.done)), "der Drill zählt als Lernzeit");
  await p.evaluate(() => ACT.drillDone());

  // falsch im Drill setzt die Serie zurück und erhöht den Zähler
  await p.evaluate(() => ACT.startDrill(null, { v: "eroerterung" }));
  await answerDrill(true);
  await p.waitForSelector('[data-act="drillDone"]');
  await p.evaluate(() => ACT.drillDone());
  await p.evaluate(() => ACT.startDrill(null, { v: "eroerterung" }));
  await answerDrill(false);
  await p.waitForSelector('[data-act="drillDone"]');
  const after = await p.evaluate(() => S.misses.find(m => m.topicId === "eroerterung"));
  ok(after.streak === 0 && after.n === 2, "eine falsche Antwort setzt die Serie zurück und zählt hoch");
  await p.evaluate(() => ACT.drillDone());

  // richtige Antwort in einer normalen Lektion löst ebenfalls
  ok(await p.evaluate(() => {
    const m = S.misses[0];
    recordAnswer(m.topicId, { q: m.q, opts: m.opts, a: m.a, why: m.why }, m.a, true);
    recordAnswer(m.topicId, { q: m.q, opts: m.opts, a: m.a, why: m.why }, m.a, true);
    return S.misses.length;
  }) === 0, "auch außerhalb des Drills zählen richtige Antworten");

  await p.evaluate(() => { VIEW = "miss"; render(); });
  ok(/noch keine stolpersteine/i.test(await p.evaluate(() => document.body.innerText)), "leere Liste wird ehrlich benannt");

  for (const lang of ["en", "tr"]) {
    await p.evaluate(l => ACT.setLang(null, { v: l }), lang);
    const txt = await p.evaluate(() => document.body.innerText);
    ok(!/\bms_[a-z_]+|\bnav_miss/.test(txt), `[${lang}] keine fehlenden Übersetzungen`);
  }
  await ctx.close();
}
