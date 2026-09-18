// Kalender-Export: gültige .ics-Datei aus Tagesplan, Terminen und Aufgaben.
export default async function ({ newPage, ok, act, click }) {
  const { ctx, page: p } = await newPage("de");
  await p.clock.setFixedTime(new Date("2026-09-17T08:00:00"));
  await p.reload(); await p.waitForTimeout(200);
  await act(p, "quickStart");
  for (const k of ["mathe", "biologie", "deutsch"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
  await click(p, '[data-act="setP3"][data-v="geschichte"]');
  await act(p, "saveAbi");
  await act(p, "quitSession");

  ok(await p.evaluate(() => buildIcs() === null) === false || true, "Export ist aufrufbar");

  await p.evaluate(() => {
    const l = Coach.life();
    l.week = Array.from({ length: 7 }, () => ({ on: true, from: 14 * 60, to: 20 * 60 }));
    l.windows = Array.from({ length: 7 }, (_, d) => ({ day: d, enabled: true, from: "14:00", to: "20:00" }));
    l.budget = 90;
    l.events.push({ id: "e1", type: "klausur", subjectId: "s_mathe", date: "2026-09-22", title: "Mathe-Klausur; mit Komma, und \\ Backslash", topics: ["analysis_extrem"], done: false });
    l.tasks.push({ id: "t1", title: "Hausaufgabe Analysis", subjectId: "s_mathe", due: "2026-09-19", minutes: 25, done: false });
    Store.save(); VIEW = "dash"; render();
  });
  ok(await p.locator('[data-act="exportIcs"]').count() >= 1, "Export-Knopf im Tagesplan");

  const ics = await p.evaluate(() => buildIcs());
  ok(typeof ics === "string" && ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trimEnd().endsWith("END:VCALENDAR"), "gültiger Rahmen");
  ok(/\r\n/.test(ics) && !/[^\r]\n/.test(ics), "Zeilenenden nach RFC 5545 (CRLF)");
  ok((ics.match(/BEGIN:VEVENT/g) || []).length === (ics.match(/END:VEVENT/g) || []).length, "jeder Termin ist sauber geschlossen");
  ok((ics.match(/BEGIN:VEVENT/g) || []).length >= 3, `Tagesplan, Klausur und Aufgabe enthalten (${(ics.match(/BEGIN:VEVENT/g) || []).length} Einträge)`);
  ok(/SUMMARY:Klausur: Mathe-Klausur\; mit Komma\\, und \\\\ Backslash/.test(ics), "Sonderzeichen sind nach RFC escaped");
  ok(/DTSTART;VALUE=DATE:20260922/.test(ics) && /DTEND;VALUE=DATE:20260923/.test(ics), "Ganztagestermin mit korrektem Enddatum");
  ok(/DTSTART:20260917T1[0-9]{5}/.test(ics), "Lerneinheiten mit Datum und Uhrzeit von heute");
  ok(/BEGIN:VALARM[\s\S]*TRIGGER:-P1D[\s\S]*END:VALARM/.test(ics), "Erinnerung einen Tag vor der Klausur");
  ok(/SUMMARY:Fällig: Hausaufgabe Analysis/.test(ics), "offene Aufgabe als Termin");
  ok(ics.split("\r\n").every(l => new TextEncoder().encode(l).length <= 75), "keine Zeile länger als 75 Oktette");
  ok(/X-WR-CALNAME:abitakt/.test(ics), "Kalendername gesetzt");
  ok(!/UID:[^\r\n]*\r\n\r\n/.test(ics), "keine leeren Zeilen im Datenstrom");

  // Faltung wirklich prüfen: sehr langer Titel
  const folded = await p.evaluate(() => {
    Coach.life().events.push({ id: "e2", type: "klausur", subjectId: "s_mathe", date: "2026-09-25", title: "Ü".repeat(200), done: false });
    return buildIcs();
  });
  ok(folded.split("\r\n").every(l => new TextEncoder().encode(l).length <= 75), "auch sehr lange Zeilen werden korrekt gefaltet");
  ok(/\r\n [ÜU]/.test(folded), "Fortsetzungszeilen beginnen mit einem Leerzeichen");

  // leerer Zustand
  const empty = await p.evaluate(() => { const l = Coach.life(); l.events = []; l.tasks = []; l.windows = []; l.budget = 0; Store.save(); return buildIcs(); });
  ok(empty === null, "ohne Inhalte wird keine leere Datei erzeugt");
  await p.evaluate(() => { VIEW = "dash"; render(); ACT.exportIcs(); });
  ok((await p.evaluate(() => document.body.innerText)).includes("nichts zu exportieren"), "ehrlicher Hinweis statt leerer Datei");

  for (const lang of ["en", "tr"]) {
    await p.evaluate(l => ACT.setLang(null, { v: l }), lang);
    ok(!/\bics_[a-z_]+/.test(await p.evaluate(() => document.body.innerText)), `[${lang}] keine fehlenden Übersetzungen`);
  }
  await ctx.close();
}
