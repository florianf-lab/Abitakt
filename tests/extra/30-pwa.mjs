// Installierbare App: Manifest, Service Worker, Offline-Start
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };

export default async function ({ ok }) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = join(root, path === "/" ? "index.html" : path);
    try { const body = await readFile(file); res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const exe = ["/opt/pw-browsers/chromium"].find(existsSync);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ locale: "de-DE" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(base);
  const manifest = await p.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    const m = await (await fetch(href)).json();
    const icons = await Promise.all(m.icons.map(i => fetch(new URL(i.src, href)).then(r => r.ok)));
    return { name: m.short_name, display: m.display, icons: icons.every(Boolean), n: m.icons.length };
  });
  ok(manifest.name === "abitakt" && manifest.display === "standalone" && manifest.icons && manifest.n === 3, "Manifest + Icons erreichbar");
  const active = await p.evaluate(async () => { const reg = await navigator.serviceWorker.ready; return !!reg.active; });
  ok(active, "Service Worker aktiv");
  await p.reload();                              // jetzt vom Service Worker kontrolliert
  await p.waitForTimeout(300);
  await ctx.setOffline(true);
  await p.evaluate(() => window.dispatchEvent(new Event("offline")));
  ok(await p.locator("#reward.show").count() === 1, "Offline-Hinweis erscheint");
  await p.reload();
  await p.waitForTimeout(300);
  ok(await p.locator('[data-act="quickStart"]').count() === 1, "App startet offline");
  ok(errors.length === 0, "keine JS-Fehler" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.setOffline(false);
  await browser.close();
  server.close();
}
