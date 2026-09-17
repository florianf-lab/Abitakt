// Prüft, dass der Engine-Block in index.html unverändert ist.
// Neue Prüfsumme setzen (nur Florian!):  node tests/engine-guard.mjs --update
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const start = html.indexOf("const BLOCKS = [");
const end = html.indexOf("/* ---------- 5. SCREENS");
if (start < 0 || end < 0 || end <= start) {
  console.error("ENGINE-GUARD: Engine-Block nicht gefunden – Markierungen verändert?");
  process.exit(1);
}
const block = html.slice(start, end).replace(/\r\n/g, "\n");
const hash = createHash("sha256").update(block).digest("hex");
const file = join(root, "tests", "engine.sha256");

if (process.argv.includes("--update")) {
  writeFileSync(file, hash + "\n");
  console.log("ENGINE-GUARD: Prüfsumme gespeichert:", hash);
  process.exit(0);
}
const expected = readFileSync(file, "utf8").trim();
if (hash !== expected) {
  console.error("ENGINE-GUARD: FEHLER – der Engine-Block wurde verändert!");
  console.error("  erwartet:", expected, "\n  aktuell: ", hash);
  process.exit(1);
}
console.log("ENGINE-GUARD: ok (" + hash.slice(0, 12) + "…)");
