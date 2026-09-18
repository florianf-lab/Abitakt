export default async function ({ newPage, ok, act, click, runSession }) {
  for (const lang of ['de', 'en', 'tr']) {
    const { ctx, page: p } = await newPage(lang);
    // Works when loaded by either the original e2e.mjs or e2e-v2.mjs.
    await p.setViewportSize({ width: 390, height: 844 });
    ok(await p.locator('.welcome-v2').count() === 1, `[${lang}] V2 welcome`);
    ok(await p.locator('[data-act="quickStart"].btn-primary').count() === 1, `[${lang}] prominent quick start`);
    ok(await p.evaluate(() => KEY === 'abitakt.v1'), 'Profil-Speicher kompatibel mit bestehenden Nutzern');
    const noOverflow = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(await noOverflow(), `[${lang}] mobile welcome fits`);
    await act(p, 'quickStart');
    for (const k of ['mathe', 'biologie', 'deutsch']) await click(p, `[data-act="togLf"][data-v="${k}"]`);
    await click(p, '[data-act="setP3"][data-v="geschichte"]');
    ok(await noOverflow(), `[${lang}] subject selection fits`);
    await act(p, 'saveAbi');
    ok(await p.locator('.focus-card').count() === 1, `[${lang}] real learning session starts`);
    ok(await noOverflow(), `[${lang}] mobile lesson fits`);
    const topic = await p.evaluate(() => SES.topicId);
    await click(p, '[data-act="setLang"][data-v="en"]');
    ok(await p.evaluate(id => SES && SES.topicId === id, topic), `[${lang}] language switch preserves lesson`);
    await p.evaluate(() => { SES.phase = 'practice'; renderPractice(); });
    const question = await p.evaluate(() => ({q:SES.cur.q,t0:SES.t0,opts:[...document.querySelectorAll('.opt')].map(el=>el.dataset.v)}));
    await click(p, '[data-act="setLang"][data-v="tr"]');
    ok(await p.evaluate(before => SES.cur.q === before.q && SES.t0 === before.t0 && JSON.stringify([...document.querySelectorAll('.opt')].map(el=>el.dataset.v)) === JSON.stringify(before.opts),question), `[${lang}] language switch preserves question, order and timer`);
    await click(p, `[data-act="setLang"][data-v="${lang}"]`);
    await click(p, '[data-act="ansPractice"]');
    await act(p, 'quitSession');
    await p.waitForTimeout(2800);
    ok(await p.locator('nav.topbar').count() === 1, `[${lang}] quitting during feedback stays on dashboard`);
    const authored = await p.evaluate(() => Object.keys(TOPICS).length);
    ok(await p.locator('section [data-act="openTopic"]').count() === authored, `[${lang}] alle ${authored} ausgearbeiteten Lektionen aufgeführt`);
    ok((await p.evaluate(() => document.body.innerText)).includes(authored + " ausgearbeitete Lektionen") || lang !== "de", `[${lang}] die Anzahl im Text stimmt`);
    const before = await p.evaluate(() => JSON.stringify({log:S.log,xp:S.xp,progress:S.progress}));
    await p.evaluate(() => startSession('geometrie_ebenen'));
    ok(await p.locator('[data-act="ansPractice"]').count() === 0, `[${lang}] unavailable topic has no fake exercise`);
    ok(await p.evaluate(() => JSON.stringify({log:S.log,xp:S.xp,progress:S.progress})) === before, `[${lang}] unavailable topic earns no progress`);
    await click(p, '[data-act="go"][data-v="dash"]');
    const bounds = await p.locator('.nav').boundingBox();
    ok(bounds.y > 700 && bounds.y + bounds.height <= 845, `[${lang}] bottom navigation within viewport`);
    for (const view of ['prog', 'prof', 'dash']) {
      await click(p, `[data-act="go"][data-v="${view}"]`);
      ok(await p.locator(`[aria-current="page"][data-v="${view}"]`).count() === 1, `[${lang}] navigation to ${view}`);
      ok(await noOverflow(), `[${lang}] ${view} fits mobile`);
    }
    await p.reload();
    ok(await p.evaluate(() => S.stage === 'app' && S.subjects.length === 4), `[${lang}] plan survives reload`);
    await p.setViewportSize({width: 1440, height: 1000});
    ok(await noOverflow(), `[${lang}] desktop dashboard fits`);
    if (lang === 'de') {
      for (const id of ['neuro_ap', 'gesch_teilung']) {
        ok(await runSession(p, id) > 0, `${id}: complete authored lesson`);
      }
    }
    ok(p.errors.length === 0, `[${lang}] no JavaScript errors: ${p.errors.join(' | ')}`);
    await ctx.close();
  }
}
