// Budget and lock behaviour under concurrency – the failure mode is overspending,
// so these run many requests at once against a store stub with real etags.
import { getStore } from "./store-stub.mts";
import { reserveSlot, releaseSlot, recordOutcome, spendDayMonth, acquireLock, releaseLock, failLock } from "../../netlify/lib/atomic.mts";
import { ok, head } from "./harness.mts";

export default async function () {
  head("atomic.mts – Budget und Sperren");
  const budget: any = getStore("budget");
  const res = await Promise.all(Array.from({ length: 30 }, () => reserveSlot(budget, "2026-09", 8)));
  ok(res.filter(r => r.ok).length === 8, "30 gleichzeitige Anfragen ergeben genau 8 Reservierungen");
  ok(budget._raw["2026-09"].v.used === 8, "der Zähler steht exakt auf dem Limit");
  ok(res.filter(r => !r.ok).every(r => r.left === 0), "abgelehnte Anfragen melden 0 frei");
  ok(res.filter(r => r.ok).map(r => r.left).sort((a, b) => a - b).join() === "0,1,2,3,4,5,6,7", "jede Reservierung meldet den eigenen Reststand");

  await releaseSlot(budget, "2026-09");
  ok(budget._raw["2026-09"].v.used === 7, "ein nie gestarteter Auftrag gibt den Platz zurück");
  await recordOutcome(budget, "2026-09", { input: 100, output: 50, calls: 2 }, true);
  ok(budget._raw["2026-09"].v.ok === 1 && budget._raw["2026-09"].v.used === 7, "das Ergebnis zählt, verbraucht aber keinen zweiten Platz");
  await recordOutcome(budget, "2026-09", { input: 10, output: 5, calls: 1 }, false);
  ok(budget._raw["2026-09"].v.failed === 1 && budget._raw["2026-09"].v.calls === 3, "Fehlschläge und Modellaufrufe werden mitgezählt");

  const old: any = getStore("budget-old");
  await old.setJSON("2026-08", { generations: 5, failed: 1 });
  const r = await reserveSlot(old, "2026-08", 8);
  ok(r.ok && old._raw["2026-08"].v.used === 6, "ein alter Zählerstand (generations) geht nicht verloren");

  const d: any = getStore("day");
  const many = await Promise.all(Array.from({ length: 40 }, () => spendDayMonth(d, "feedback", { perDay: 25, perMonth: 150 })));
  ok(many.filter(x => x.ok).length === 25, "das Tageslimit hält auch bei 40 gleichzeitigen Korrekturen");
  ok(many.filter(x => !x.ok).every(x => x.reason === "day"), "abgelehnte Anfragen nennen den Grund");
  const m: any = getStore("month");
  await m.setJSON("oral", { day: new Date().toISOString().slice(0, 10), used: 0, month: new Date().toISOString().slice(0, 7), monthUsed: 150 });
  ok((await spendDayMonth(m, "oral", { perDay: 25, perMonth: 150 })).reason === "month", "das Monatslimit greift getrennt vom Tageslimit");

  const jobs: any = getStore("jobs");
  const locks = await Promise.all(Array.from({ length: 10 }, () => acquireLock(jobs, "k", 60000)));
  ok(locks.filter(l => l.ok).length === 1, "nur eine von zehn Anfragen bekommt die Sperre");
  ok((await acquireLock(jobs, "k", 60000)).ok === false, "die Sperre bleibt gehalten, solange die Frist läuft");
  ok((await acquireLock(jobs, "k", 1)).ok === true, "eine abgelaufene Sperre darf übernommen werden");
  await releaseLock(jobs, "k");
  ok((await acquireLock(jobs, "k", 60000)).ok === true, "nach der Freigabe ist die Sperre wieder frei");
  await failLock(jobs, "k", ["kaputt"]);
  ok(jobs._raw["k"].v.state === "failed", "ein Fehlschlag wird als solcher vermerkt");
}
