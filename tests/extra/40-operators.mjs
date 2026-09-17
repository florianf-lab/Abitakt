// Operatoren-Trainer (Mathematik BW)
export default async function ({ newPage, ok, act, click }) {
  for (const lang of ["de", "en", "tr"]) {
    const { ctx, page: p } = await newPage(lang);
    await act(p, "quickStart");
    for (const k of ["mathe", "biologie", "geschichte"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
    await click(p, '[data-act="setP3"][data-v="deutsch"]');
    await act(p, "saveAbi");
    await act(p, "quitSession");
    await click(p, '[data-act="go"][data-v="ops"]');
    const n = await p.evaluate(() => OPERATORS.length);
    ok(n === 21 && await p.getByText("überprüfen", { exact: true }).count() === 1, `[${lang}] Übersicht zeigt alle ${n} Operatoren`);
    const data = await p.evaluate(() => OPERATORS.every(o => o.def && o.exp && o.ex && [1, 2, 3].includes(o.afb)));
    ok(data, `[${lang}] jeder Operator hat Definition, Erklärung, Beispiel, AFB`);
    // Eindeutigkeit: in 200 Quizzen nie zwei gleiche Optionen, richtige Antwort immer genau einmal
    const uniq = await p.evaluate(() => {
      for (let k = 0; k < 200; k++) for (const q of buildOpQuiz(8)) {
        if (new Set(q.opts).size !== 4) return false;
        if (q.opts.filter(o => o === q.a).length !== 1) return false;
      }
      return true;
    });
    ok(uniq, `[${lang}] Quizfragen immer eindeutig`);
    await act(p, "opStart");
    for (let i = 0; i < 8; i++) {
      await p.locator('.opt[data-act="opAns"]').first().click();
      await p.waitForSelector('.opt[data-act="opAns"], [data-act="opAgain"], [data-act="opStart"]', { timeout: 6000 });
    }
    ok(await p.locator('[data-act="opStart"]').count() === 1, `[${lang}] Quiz bis zum Ergebnis`);
    const stats = await p.evaluate(() => Object.values(S.opStats).reduce((a, s) => a + s[1], 0));
    ok(stats === 8, `[${lang}] 8 Antworten gespeichert`);
    await act(p, "opExit");
    ok(await p.locator('nav [aria-current="page"][data-v="ops"]').count() === 1, `[${lang}] zurück in der Übersicht`);
    ok(p.errors.length === 0, `[${lang}] keine JS-Fehler` + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
    await ctx.close();
  }
}
