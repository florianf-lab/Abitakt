// Schnellstart: Fächer wählen -> direkt erste Session -> Profil später vervollständigen
export default async function ({ newPage, ok, act, click, fullOnboarding }) {
  for (const lang of ["de", "en", "tr"]) {
    const { ctx, page: p } = await newPage(lang);
    await act(p, "quickStart");
    ok(await p.locator(".rail").count() === 0, `[${lang}] Schnellstart ohne Fortschrittsbalken`);
    for (const k of ["mathe", "englisch", "physik"]) await click(p, `[data-act="togLf"][data-v="${k}"]`);
    await click(p, '[data-act="setP3"][data-v="deutsch"]');
    await act(p, "saveAbi");
    ok(await p.locator(".focus-card").count() === 1, `[${lang}] erste Lernsession startet sofort`);
    const st = await p.evaluate(() => ({ quick: S.quick, stage: S.stage, n: S.subjects.length, cog: S.cog.pattern,
      exam: S.subjects[0].topics[0].exam, interests: S.person.interests.length }));
    ok(st.quick === true && st.stage === "app" && st.n === 4, `[${lang}] Plan angelegt, Profil als unvollständig markiert`);
    ok(st.cog === null && st.interests === 0, `[${lang}] keine erfundenen Profilwerte`);
    ok(/^2027-0[45]-\d\d$/.test(st.exam), `[${lang}] echter BW-Prüfungstermin (${st.exam})`);
    await act(p, "quitSession");
    ok(await p.locator('[data-act="begin"]').count() === 1, `[${lang}] Dashboard zeigt „Profil vervollständigen“`);
    if (lang === "de") {
      // Profil vervollständigen: Fächer müssen vorausgewählt sein
      await p.evaluate(() => { ACT.begin(); FLOW.abi = null; scrAbi(); });
      const pre = await p.evaluate(() => FLOW.abi);
      ok(pre.lf.join() === "mathe,englisch,physik" && pre.p3 === "deutsch", "Fächer beim Vervollständigen vorausgewählt");
      await p.evaluate(() => { S.subjects = []; S.stage = "welcome"; S.quick = true; scrWelcome(); });
      // gleiche Fächer erneut über den vollen Weg -> quick wird false
      await fullOnboarding(p);
      ok(await p.evaluate(() => S.quick) === false, "nach vollem Onboarding ist das Profil vollständig");
      // Fächer ändern aus dem Profil führt zurück ins Profil
      await p.evaluate(() => ACT.go(null, { v: "prof" }));
      await act(p, "editAbi");
      const pre2 = await p.evaluate(() => FLOW.abi.lf.length);
      ok(pre2 === 3, "Fächer ändern: Auswahl vorausgefüllt");
      await act(p, "saveAbi");
      ok(await p.evaluate(() => VIEW) === "prof" && await p.locator('[data-act="editAbi"]').count() === 1, "Fächer ändern: zurück im Profil");
    }
    ok(p.errors.length === 0, `[${lang}] keine JS-Fehler` + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
    await ctx.close();
  }
}
