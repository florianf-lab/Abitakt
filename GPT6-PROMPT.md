# Prompt für GPT-6 (oder eine andere KI)

**So benutzt du ihn:**
1. Hänge diese Dateien an. Falls die KI den Dateityp nicht annimmt, benenne sie vorher in `.txt` um:
   - `index.html`
   - `HANDOFF.md`
   - `BUILD-GUIDE.md`
   - `tests/e2e.mjs`
2. Kopiere **einen** der beiden Prompts unten (A oder B) und schreib die Aufgabe in die eckigen Klammern.

---

## Prompt A – bestehende App verbessern

```
Du arbeitest an "abitakt", einer adaptiven Abitur-Lern-App (Baden-Württemberg, Abitur 2027).
Angehängt sind index.html (die komplette App), HANDOFF.md, BUILD-GUIDE.md und tests/e2e.mjs.

Lies zuerst HANDOFF.md vollständig und halte dich strikt an Abschnitt 0 "Arbeitsregeln".
Das Wichtigste:
- Liefere nur vollständige Dateien oder echte Unified-Diffs. Keine "..."-Auslassungen, kein "Rest bleibt gleich".
- Nutze nur Funktionsnamen, die wirklich im Code stehen (Übersicht in HANDOFF.md Abschnitt 3). Nichts raten.
- Der Engine-Block (von "const BLOCKS = [" bis "/* ---------- 5. SCREENS") bleibt Zeichen für Zeichen unverändert. Auch kein Überschreiben per "Engine.x = ...".
- Keine simulierten oder Platzhalter-Inhalte als fertig ausgeben.
- Jeder neue Oberflächentext in Deutsch, Englisch und Türkisch (im Block "3a-2" vor "let LANG").
- Lerninhalte bleiben Deutsch.

Aufgabe: [HIER DIE AUFGABE, z. B. "Punkt 1 aus HANDOFF.md Abschnitt 5: PWA mit manifest.webmanifest und sw.js"]

Vorgehen:
1. Nenne kurz, welche Stellen in index.html du ändern wirst (mit den echten Funktionsnamen).
2. Liefere alle geänderten und neuen Dateien vollständig.
3. Liefere eine neue Testdatei tests/extra/NN-name.mjs im Format aus HANDOFF.md Abschnitt 6.
4. Schreib am Ende ehrlich: was getestet ist, was nicht, und welche Annahmen du getroffen hast.
```

---

## Prompt B – eigene zweite Version bauen

```
Du baust eine eigene, zweite Version von "abitakt", einer adaptiven Abitur-Lern-App für Baden-Württemberg (Abitur 2027, volljährige Nutzer).
Angehängt sind index.html (Version 1), HANDOFF.md und BUILD-GUIDE.md.

Lies HANDOFF.md vollständig, besonders Abschnitt 0, 4 und 7.

Ziel: [HIER DEIN ZIEL, z. B. "ein moderneres, mobilfreundlicheres Design mit Fokus auf den Schnellstart"]

Regeln:
- Neue Datei index-v2.html, eine einzige selbstständige Datei ohne Build-Schritt.
- Übernimm die adaptive Engine aus Version 1 unverändert, oder kennzeichne jede Abweichung klar mit Begründung.
- Übernimm die BW-Fächer, Themen und Prüfungstermine (SUBJECTS_BW, ABI) und die drei handgeschriebenen Lektionen.
- Oberfläche in Deutsch, Englisch und Türkisch; Lerninhalte auf Deutsch.
- Halte die Leitplanken ein: kein "IQ-Test", Terminhinweis "mit der Schule abgleichen", keine Nähe zum Kultusministerium, Profildaten nur lokal.
- Liefere die komplette Datei ohne Auslassungen. Wenn sie zu lang für eine Antwort ist, teile sie in nummerierte Teile auf, die man exakt hintereinander kopiert, und sag vorher, wie viele Teile es werden.
- Schreib am Ende ehrlich, was fertig ist und was nicht.
```
