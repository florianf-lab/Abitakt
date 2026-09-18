// Prüft die handgeschriebenen Lektionen: vollständige Darstellungsformen, eindeutige
// Antwortoptionen, steigende Schwierigkeit, kein ausführbarer Code. Braucht keinen Browser.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];
const start = src.indexOf("const TOPICS = {");
const end = src.indexOf("\n/* ---------- 4. ADAPTIVE ENGINE");
const block = src.slice(start, end > 0 ? end : src.indexOf("const BLOCKS = ["));
const TOPICS = new Function(block + "; return TOPICS;")();
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("  ✗ " + m); } else console.log("  ✓ " + m); };
for (const [id, l] of Object.entries(TOPICS)) {
  console.log("\n" + id + " – " + l.name);
  ok(l.subject && l.name && l.load > 0, "Kopfdaten vollständig");
  ok(l.steps.length >= 3, `${l.steps.length} Lernschritte`);
  ok(l.steps.every(s => s.t && ["visual","auditory","kinesthetic","textual"].every(m => s[m] && s[m].length > 120)), "jeder Schritt in allen vier Darstellungsformen");
  ok(l.practice.length >= 9 && l.practice.length <= 12, `${l.practice.length} Übungsaufgaben`);
  ok(l.practice.every(p => p.opts.length === 4 && new Set(p.opts).size === 4), "vier eindeutige Antwortoptionen je Aufgabe");
  ok(l.practice.every(p => p.opts.includes(p.a)), "die richtige Antwort steht unter den Optionen");
  ok(l.practice.every(p => p.why && p.why.length > 20), "jede Aufgabe hat eine Begründung");
  ok(l.practice.every(p => !p.wrong || Object.keys(p.wrong).every(k => p.opts.includes(k) && k !== p.a)), "Denkfehler-Hinweise gehören zu falschen Optionen");
  const ds = l.practice.map(p => p.d);
  ok(ds.every((d, i) => i === 0 || d >= ds[i-1]), "Schwierigkeit steigt monoton");
  ok(ds[0] <= 0.3 && ds[ds.length-1] >= 0.75, `Spanne ${ds[0]} bis ${ds[ds.length-1]}`);
  ok(!/<script|onerror=|onload=/i.test(JSON.stringify(l)), "kein ausführbarer Code im Inhalt");
}
console.log(bad ? `\n${bad} FEHLER` : "\nAlle Lektionen in Ordnung.");
process.exit(bad ? 1 : 0);
