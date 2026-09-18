// Rechtliche Seiten: erreichbar vor und nach dem Onboarding, in allen drei Sprachen,
// und sie beschreiben genau das, was der Code tatsächlich verschickt.
export default async function ({ newPage, ok, act, click }) {
  const { ctx, page: p } = await newPage("de");

  // vom Startbildschirm aus erreichbar
  await click(p, '[data-act="legal"][data-v="privacy"]');
  const txt = () => p.evaluate(() => document.body.innerText);
  let t0 = await txt();
  ok(/bleibt auf deinem ger.t/i.test(t0), "Datenschutz vom Startbildschirm aus erreichbar");
  ok(/revDSG/.test(t0) && /DSGVO/.test(t0), "das anwendbare Recht ist benannt");
  ok(/USA/.test(t0), "es steht da, wohin die KI-Anfragen gehen");
  ok(/\/api\/feedback/.test(t0) && /\/api\/oral/.test(t0) && /\/api\/sync/.test(t0), "jeder Endpunkt, der Daten empfängt, ist aufgeführt");
  ok(/nicht gespeichert/.test(t0), "es steht da, dass Antworten nicht gespeichert werden");
  ok(/Netlify/.test(t0) && /Anthropic/.test(t0), "beide beteiligten Dienste sind genannt");
  ok(/keine? Rechtsberatung/i.test(t0), "der Hinweis, dass das keine Rechtsberatung ist, fehlt nicht");

  await click(p, '[data-act="legal"][data-v="imprint"]');
  let t1 = await txt();
  ok(/noch nicht vollst.ndig/i.test(t1), "solange die Anbieterangaben fehlen, warnt das Impressum von selbst");
  ok(/noch einzutragen/.test(t1), "die fehlenden Felder sind einzeln markiert");
  ok(/Schweiz/.test(t1) && /Baden-Württemberg/.test(t1), "Sitz und Zielgruppe sind benannt");

  await click(p, '[data-act="legal"][data-v="about"]');
  let t2 = await txt();
  ok(/Kein Angebot des Kultusministeriums/.test(t2), "die Abgrenzung zum Kultusministerium steht drin");
  ok(/Kein Test von Intelligenz/.test(t2), "kein IQ-Versprechen");
  ok(/Keine Garantie für eine Note/.test(t2), "keine Notengarantie");

  // sobald die Angaben eingetragen sind, verschwindet die Warnung
  const saved = await p.evaluate(() => {
    const o = Object.assign({}, OPERATOR);
    Object.assign(OPERATOR, { name: "Testperson", street: "Testweg 1", city: "8000 Teststadt", email: "test@example.ch" });
    scrLegal("imprint"); return o;
  });
  const t3 = await txt();
  ok(!/noch nicht vollst.ndig/i.test(t3) && /Testweg 1/.test(t3), "mit vollständigen Angaben ist die Warnung weg");
  ok(!/noch einzutragen/.test(t3), "dann ist auch kein Feld mehr als offen markiert");
  await p.evaluate(o => { Object.assign(OPERATOR, o); scrLegal("imprint"); }, saved);

  // zurück und dann im Profil
  await act(p, "legalBack");
  ok(await p.locator('[data-act="quickStart"]').count() === 1, "zurück führt zum Startbildschirm");
  await act(p, "quickStart");
  for (const k of ["mathe", "biologie", "geschichte"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
  await click(p, '[data-act="setP3"][data-v="deutsch"]');
  await act(p, "saveAbi");
  await act(p, "quitSession");
  await p.evaluate(() => ACT.go(null, { v: "prof" }));
  ok(await p.locator('[data-act="legal"][data-v="privacy"]').count() >= 1, "im Profil verlinkt");
  await click(p, '[data-act="legal"][data-v="privacy"]');
  await act(p, "legalBack");
  ok(await p.evaluate(() => VIEW) === "prof", "aus der App zurück ins Profil");

  for (const lang of ["en", "tr"]) {
    await p.evaluate(l => ACT.setLang(null, { v: l }), lang);
    for (const tab of ["privacy", "imprint", "about"]) {
      await p.evaluate(v => scrLegal(v), tab);
      const s = await txt();
      ok(!/\blg_[a-z_]+/.test(s), `[${lang}] ${tab}: keine fehlenden Übersetzungen`);
    }
  }
  await ctx.close();
}
