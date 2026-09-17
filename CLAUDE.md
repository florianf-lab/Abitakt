# abitakt – Projektregeln für KI-Agenten

abitakt ist eine adaptive Abitur-Lern-App für Baden-Württemberg (Abitur 2027), eine einzige
Datei `index.html` ohne Build-Schritt, plus Netlify-Funktionen für KI-Lektionen.
Live: https://abifix.netlify.app · Repo: florianf-lab/Abitakt (Netlify deployt `main` automatisch).

Ausführliche Code-Landkarte: `HANDOFF.md`. Architektur und Spezifikationen: `BUILD-GUIDE.md`.
Aktueller Stand: `STAND.md`.

## Harte Regeln

1. **Engine ist tabu.** Der Block von `const BLOCKS = [` bis `/* ---------- 5. SCREENS` bleibt
   Zeichen für Zeichen unverändert – auch kein Überschreiben per `Engine.x = ...`.
   Prüfen mit `node tests/engine-guard.mjs`.
2. **Ebenfalls unverändert:** die drei handgeschriebenen Lektionen (`analysis_extrem`, `neuro_ap`,
   `gesch_teilung`), die Aufgabenbanken des Assessments (`PATTERN`, `LOGIC`, `SPEED`, `STYLE_Q`, `ATT_Q`).
3. **Keine Auslassungen.** Dateien immer vollständig schreiben, nie „… Rest bleibt gleich …“.
4. **Keine erfundenen Funktionsnamen.** Erst im Code suchen (`HANDOFF.md` Abschnitt 3), dann schreiben.
5. **Keine Platzhalter-Inhalte als fertig ausgeben.** Simulierte KI-Antworten werden nie gespeichert.
6. **Nichts als erledigt melden, was nicht getestet ist.** Ungetestetes ehrlich benennen.
7. **Drei Sprachen.** Jeder neue Oberflächentext in DE/EN/TR (Blöcke „3a-2“ und „3a-3“ vor `let LANG`).
   Lerninhalte bleiben Deutsch – die Prüfung ist auf Deutsch.
8. **Fachlicher Fortschritt nur durch echte Übungsantworten.** Einheiten mit eigenen Unterlagen
   zählen als Lernzeit, nie als Beherrschung. Platzhalter-Themen erzeugen keinen Fortschritt.

## Befehle

```bash
npm install                    # einmalig, danach: npx playwright install chromium
node tests/engine-guard.mjs    # Engine-Prüfsumme (Sekunden)
node tests/e2e.mjs --extra     # Tests der Zusatzfunktionen (ca. 3 Min)
npm test                       # alles inkl. Onboarding in DE/EN/TR (ca. 8 Min)
```

Nach jeder Änderung an `index.html`: mindestens `engine-guard` + `e2e.mjs --extra`.
Neue Funktion → neue Datei `tests/extra/NN-name.mjs` (Format siehe `HANDOFF.md` Abschnitt 6).

## Aufbau (Kurzfassung)

- `index.html` – Abschnitte 1 Store · 2 Util · 3 Sprache/Inhalte · 4 Engine (tabu) · 5 Onboarding ·
  6 App-Ansichten (6.5 Operatoren, 6.6 Lernbegleiter) · 7 Boot · 8 Offline
- `netlify/functions/lesson.mts` – `/api/lesson`: Status/Start, Themen-Whitelist, Budgetbremse
- `netlify/functions/lesson-generate.mts` – Hintergrund: Lektion erzeugen → Fachprüfer → Blobs
- `netlify/lib/lesson-core.mts` – Prompts, Tool-Schemata, Validierung, Review
- `sw.js`, `manifest.webmanifest`, `icons/` – installierbare App, Offline

## Recht & Ehrlichkeit

- Nie „IQ-Test“; das Assessment ist ein nicht-klinisches Kalibrierungssignal.
- Prüfungstermine immer mit Hinweis „mit der Schule abgleichen“.
- Keine Nähe zum Kultusministerium andeuten, keine Original-Abituraufgaben kopieren.
- Profildaten bleiben im Browser; an die Server-Funktion gehen keine Lernerdaten.
- Feste „Lerntypen“ sind nicht belegt: in der Oberfläche „Darstellungsform“, gemessen wird, was wirkt.

## Kosten

KI-Lektionen kosten Netlify-Credits (2 Modellaufrufe pro Lektion, ca. 3 Min). Die Bremse steht in
`MAX_GENERATIONS_PER_MONTH` (Standard 8). Cache-Schlüssel niemals ohne Grund erhöhen – das erzwingt
eine Neu-Erzeugung aller Lektionen.
