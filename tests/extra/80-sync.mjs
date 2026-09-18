// Verschlüsselte Profil-Sicherung: einrichten, auf ein zweites Gerät holen, Konflikte,
// falsches Passwort, Trennen und Löschen – gegen einen simulierten /api/sync-Server.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export default async function ({ ok }) {
  const db = new Map();
  let n = 0, mode = "ok";
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
    if (u.pathname === "/api/sync") {
      if (mode === "down") return send(500, { status: "failed" });
      const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})(?=.)/g, "$1-");
      if (req.method === "GET") {
        const rec = db.get(norm(u.searchParams.get("id")));
        return rec ? send(200, { status: "ready", blob: rec.blob, rev: rec.rev, updated: rec.updated }) : send(404, { status: "none" });
      }
      const b = JSON.parse(await new Promise(r => { let s = ""; req.on("data", c => s += c); req.on("end", () => r(s || "{}")); }));
      if (b.action === "create") {
        n++;
        const id = [0, 1, 2].map(g => Array.from({ length: 4 }, (_, i) => ALPHABET[(n * 7 + g * 3 + i) % 32]).join("")).join("-");
        db.set(id, { blob: "", rev: 0, updated: Date.now() });
        return send(200, { status: "ok", id, rev: 0 });
      }
      const id = norm(b.id), rec = db.get(id);
      if (!rec) return send(404, { status: "none" });
      if (b.action === "delete") { db.delete(id); return send(200, { status: "ok" }); }
      if (b.action === "put") {
        if (!/^[A-Za-z0-9+/=]+$/.test(String(b.blob || ""))) return send(400, { status: "bad_blob" });
        if (b.rev !== rec.rev) return send(409, { status: "conflict", blob: rec.blob, rev: rec.rev, updated: rec.updated });
        Object.assign(rec, { blob: b.blob, rev: rec.rev + 1, updated: Date.now() });
        return send(200, { status: "ok", rev: rec.rev, updated: rec.updated });
      }
      return send(400, { status: "bad_action" });
    }
    const file = join(root, u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
    try { const body = await readFile(file); res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const exe = ["/opt/pw-browsers/chromium"].find(existsSync);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const errors = [];
  const device = async () => {
    const ctx = await browser.newContext({ locale: "de-DE", serviceWorkers: "block" });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    await p.goto(base);
    return { ctx, p };
  };
  const onboard = async (p, name) => {
    await p.click('[data-act="quickStart"]');
    for (const k of ["mathe", "biologie", "englisch"]) await p.click(`[data-act="togLf"][data-v="${k}"]`);
    await p.click('[data-act="setP3"][data-v="deutsch"]');
    await p.click('[data-act="saveAbi"]');
    await p.waitForSelector(".focus-screen");
    await p.evaluate(nm => { LOADING = null; ACT.quitSession(); S.name = nm; S.xp = 4242; Store.save(); }, name);
  };

  // --- device A: set up the backup
  const a = await device();
  await onboard(a.p, "Gerät A");
  ok(await a.p.evaluate(() => syncAvailable()) === true, "Sicherung ist auf einem sicheren Kontext verfügbar");
  await a.p.evaluate(() => ACT.go(null, { v: "prof" }));
  await a.p.waitForSelector('[data-act="syncOpen"]');
  ok((await a.p.evaluate(() => document.body.innerText)).includes("nur in diesem Browser"), "Profilkarte erklärt den Zustand ohne Sicherung");
  await a.p.click('[data-act="syncOpen"]');
  await a.p.click('[data-act="syncNew"]');
  await a.p.fill("#sy-p1", "kurz");
  await a.p.fill("#sy-p2", "kurz");
  await a.p.click('[data-act="syncCreate"]');
  ok(await a.p.getByText("zu kurz", { exact: false }).count() === 1, "zu kurzes Passwort wird abgelehnt");
  await a.p.fill("#sy-p1", "mein-gutes-passwort");
  await a.p.fill("#sy-p2", "mein-anderes-passwort");
  await a.p.click('[data-act="syncCreate"]');
  ok(await a.p.getByText("nicht gleich", { exact: false }).count() === 1, "abweichende Wiederholung wird abgelehnt");
  await a.p.fill("#sy-p1", "mein-gutes-passwort");
  await a.p.fill("#sy-p2", "mein-gutes-passwort");
  await a.p.click('[data-act="syncCreate"]');
  await a.p.waitForSelector("#sync-code", { timeout: 30000 });
  const code = (await a.p.textContent("#sync-code")).trim();
  ok(ID_RE.test(code), "lesbarer Code wird angezeigt: " + code);
  const rec = db.get(code);
  ok(rec && rec.rev === 1 && rec.blob.length > 40, "verschlüsselter Block liegt auf dem Server");
  ok(!/Gerät A|4242|analysis_extrem|mathe/.test(Buffer.from(rec.blob, "base64").toString("binary")),
     "im gespeicherten Block steht nichts Lesbares");
  ok(await a.p.evaluate(() => { const s = JSON.parse(localStorage.getItem("abitakt.sync.v1")); return !!s.key && !!s.salt && !/passwort/i.test(JSON.stringify(s)); }) === true,
     "auf dem Gerät liegt der Schlüssel, nicht das Passwort");

  // automatic backup after a change
  const rev1 = db.get(code).rev;
  await a.p.evaluate(() => { S.xp = 5555; Store.save(); });
  await a.p.waitForFunction(() => SYNC && SYNC.rev >= 2, null, { timeout: 30000 });
  ok(db.get(code).rev > rev1, "Änderungen werden automatisch gesichert");

  // --- device B: wrong password, unknown code, then the real thing
  const b = await device();
  await onboard(b.p, "Gerät B");
  await b.p.evaluate(() => { ACT.go(null, { v: "prof" }); });
  await b.p.click('[data-act="syncOpen"]');
  await b.p.click('[data-act="syncJoin"]');
  await b.p.fill("#sy-code", "AAAA-BBBB-CCCC");
  await b.p.fill("#sy-pass", "egal-was-hier-steht");
  await b.p.click('[data-act="syncDoJoin"]');
  await b.p.waitForSelector("#sy-code");
  ok(await b.p.getByText("keine Sicherung", { exact: false }).count() === 1, "unbekannter Code wird gemeldet");
  await b.p.fill("#sy-code", code.toLowerCase().replace(/-/g, ""));
  await b.p.fill("#sy-pass", "falsches-passwort");
  await b.p.click('[data-act="syncDoJoin"]');
  await b.p.waitForSelector("#sy-code", { timeout: 30000 });
  ok(await b.p.getByText("nicht öffnen", { exact: false }).count() === 1, "falsches Passwort öffnet nichts");
  ok(await b.p.evaluate(() => S.name) === "Gerät B", "bei falschem Passwort bleibt das lokale Profil unangetastet");
  await b.p.fill("#sy-code", code.toLowerCase().replace(/-/g, ""));
  await b.p.fill("#sy-pass", "mein-gutes-passwort");
  await b.p.click('[data-act="syncDoJoin"]');
  await b.p.waitForFunction(() => VIEW === "dash" && S.name === "Gerät A", null, { timeout: 30000 });
  ok(await b.p.evaluate(() => S.xp) === 5555, "Profil von Gerät A ist auf Gerät B angekommen");
  ok(await b.p.evaluate(() => SYNC.id) === code, "Gerät B ist mit demselben Code verbunden");

  // --- conflict: both devices write
  await b.p.evaluate(() => { S.xp = 7000; Store.save(); });
  await b.p.waitForFunction(() => SYNC.rev >= 3, null, { timeout: 30000 });
  await a.p.evaluate(() => { S.xp = 6000; Store.save(); });
  await a.p.waitForFunction(() => SYNC && SYNC.conflictRev != null, null, { timeout: 30000 });
  await a.p.evaluate(() => ACT.syncOpen());
  ok(await a.p.getByText("Zwei Stände gefunden").count() === 1, "Konflikt wird erklärt statt still überschrieben");
  await a.p.evaluate(() => ACT.syncTakeLocal());
  await a.p.waitForFunction(() => SYNC && SYNC.conflictRev == null, null, { timeout: 30000 });
  ok(await a.p.evaluate(() => S.xp) === 6000, "eigener Stand bleibt, wenn man ihn wählt");
  await b.p.evaluate(() => { window.confirm = () => true; });
  await b.p.evaluate(() => ACT.syncPullNow());
  await b.p.waitForFunction(() => S.xp === 6000, null, { timeout: 30000 });
  ok(true, "das andere Gerät holt sich den gewählten Stand");

  // --- server down: nothing local breaks
  mode = "down";
  await a.p.evaluate(() => { S.xp = 6100; Store.save(); });
  await a.p.waitForTimeout(6000);
  ok(await a.p.evaluate(() => S.xp) === 6100 && await a.p.evaluate(() => JSON.parse(localStorage.getItem("abitakt.v1")).xp) === 6100,
     "ohne Server läuft alles lokal weiter");
  mode = "ok";

  // --- disconnect and wipe
  await a.p.evaluate(() => { window.confirm = () => true; ACT.syncOff(); });
  await a.p.waitForSelector('[data-act="syncNew"]');
  ok(await a.p.evaluate(() => !localStorage.getItem("abitakt.sync.v1")) && db.has(code), "Trennen löscht nur lokal, nicht auf dem Server");
  await b.p.evaluate(() => { window.confirm = () => true; ACT.syncOpen(); });
  await b.p.evaluate(() => ACT.syncWipe());
  await b.p.waitForSelector('[data-act="syncNew"]', { timeout: 30000 });
  ok(!db.has(code), "Sicherung lässt sich endgültig vom Server löschen");
  ok(await b.p.evaluate(() => S.xp) === 6000, "nach dem Löschen bleibt das Profil auf dem Gerät");

  // --- translations
  for (const lang of ["en", "tr"]) {
    await b.p.evaluate(l => ACT.setLang(null, { v: l }), lang);
    await b.p.evaluate(() => ACT.syncNew());
    const txt = await b.p.evaluate(() => document.body.innerText);
    ok(!/\bsy_[a-z_]+/.test(txt), `[${lang}] keine fehlenden Übersetzungen`);
  }
  ok(errors.length === 0, "keine JS-Fehler" + (errors.length ? ": " + errors.join(" | ") : ""));
  await browser.close();
  server.close();
}
