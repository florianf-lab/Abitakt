// UI-Durchlauf: komplettes Onboarding + Lernsession + alle Ansichten in DE/EN/TR.
// Start: node tests/e2e.mjs   (braucht: npm i -D playwright)
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(join(root, "index.html")).href;
const exe = ["/opt/pw-browsers/chromium"].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log("  ✓ " + msg); else { failures++; console.log("  ✗ " + msg); } };

async function newPage(lang) {
  const ctx = await browser.newContext({ locale: lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-GB" });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) page.errors.push(m.text()); });
  await page.route(/^https?:\/\//, r => r.abort());   // offline: keine externen Aufrufe im Test
  await page.goto(url);
  await page.waitForTimeout(300);
  return { ctx, page };
}
const click = (p, sel) => p.locator(sel).first().click();
const act = (p, a) => click(p, `[data-act="${a}"]`);

async function answerChoices(p, n) {
  for (let i = 0; i < n; i++) {
    await p.locator('.opt[data-act="ansChoice"]').first().click();
    await p.waitForSelector('.opt[data-act="ansChoice"], [data-act="speedGo"]', { timeout: 5000 });
  }
}

async function fullOnboarding(p) {
  await act(p, "begin");
  await act(p, "startPattern");
  const nPat = await p.evaluate(() => PATTERN.length);
  await answerChoices(p, nPat);
  const nLog = await p.evaluate(() => LOGIC.length);
  await answerChoices(p, nLog);
  await act(p, "speedGo");
  for (let i = 0; i < 12; i++) await click(p, '[data-act="ansSpeed"][data-v="eq"]');
  await act(p, "memGo");
  for (let r = 0; r < 4; r++) {
    await p.waitForSelector("#digin", { timeout: 12000 });
    await p.fill("#digin", "1234");
    await act(p, "ansMem");
  }
  await act(p, "toStyle");
  const nSt = await p.evaluate(() => STYLE_Q.length);
  for (let i = 0; i < nSt; i++) await click(p, '[data-act="ansStyle"]');
  const nAt = await p.evaluate(() => ATT_Q.length);
  for (let i = 0; i < nAt; i++) await click(p, '[data-act="ansAtt"]');
  await p.fill("#nm", "Testperson");
  for (let i = 0; i < 3; i++) await p.locator('[data-act="togInt"]').nth(i).click();
  await act(p, "savePerson");
  await act(p, "energyDefault");
  await act(p, "saveEnergy");
  for (const k of ["mathe", "biologie", "deutsch"]) { await click(p, `[data-act="togLf"][data-v="${k}"]`); }
  await click(p, '[data-act="setP3"][data-v="geschichte"]');
  await act(p, "saveAbi");
}

async function runSession(p, topicId) {
  await p.evaluate(id => ACT.openTopic(null, { v: id }), topicId);
  await p.waitForSelector(".focus-card");
  for (let guard = 0; guard < 40; guard++) {
    if (await p.locator('[data-act="nextTeach"]').count()) { await act(p, "nextTeach"); continue; }
    if (await p.locator('.opt[data-act="ansPractice"]').count()) {
      await p.locator('.opt[data-act="ansPractice"]').first().click();
      await p.waitForTimeout(2800);
      continue;
    }
    break;
  }
  return p.locator('[data-act="go"][data-v="dash"]').count();
}

const ONLY_EXTRA = process.argv.includes("--extra");
for (const lang of ONLY_EXTRA ? [] : ["de", "en", "tr"]) {
  console.log(`\n[${lang}] Volles Onboarding`);
  const { ctx, page: p } = await newPage(lang);
  ok(await p.evaluate(() => LANG) === lang, "Sprache automatisch erkannt");
  await fullOnboarding(p);
  ok(await p.locator('[data-act="go"][data-v="dash"]').count() === 1, "Onboarding abgeschlossen");
  await act(p, "go");
  ok(await p.locator("nav.topbar").count() === 1, "Dashboard mit Navigation");
  const done = await runSession(p, "analysis_extrem");
  ok(done > 0, "Lernsession (Analysis) bis zum Ende");
  ok(await p.evaluate(() => S.log.length) > 0, "Antworten wurden protokolliert");
  for (const v of ["prog", "prof", "dash"]) {
    await p.evaluate(v => ACT.go(null, { v }), v);
    ok(await p.locator("main .screen").count() === 1, `Ansicht ${v} rendert`);
  }
  // Nicht-authored Thema -> generischer Fallback darf nicht abstürzen
  const genDone = await runSession(p, "geometrie_ebenen");
  ok(genDone > 0, "Platzhalter-Thema läuft durch");
  ok(p.errors.length === 0, "keine JS-Fehler" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
  await ctx.close();
}

// i18n: jeder deutsche Schlüssel existiert auch in EN und TR
{
  console.log("\n[i18n]");
  const { ctx, page: p } = await newPage("de");
  const missing = await p.evaluate(() => {
    const out = [];
    for (const l of ["en", "tr"]) for (const k of Object.keys(I18N.de)) if (!(k in I18N[l])) out.push(l + ":" + k);
    return out;
  });
  ok(missing.length === 0, "alle Übersetzungen vorhanden" + (missing.length ? " – fehlt: " + missing.join(", ") : ""));
  await ctx.close();
}

// Zusatztests aus tests/extra/*.mjs (werden von neuen Features ergänzt)
import { readdirSync } from "node:fs";
const extraDir = join(root, "tests", "extra");
if (existsSync(extraDir)) {
  const only = (process.argv.find(x => x.startsWith("--only=")) || "").slice(7);
  for (const f of readdirSync(extraDir).filter(f => f.endsWith(".mjs") && (!only || f.includes(only))).sort()) {
    console.log(`\n[extra] ${f}`);
    const mod = await import(pathToFileURL(join(extraDir, f)).href);
    await mod.default({ newPage, ok, act, click, runSession, fullOnboarding });
  }
}

await browser.close();
console.log(failures ? `\n${failures} FEHLER` : "\nAlle UI-Tests bestanden.");
process.exit(failures ? 1 : 0);
