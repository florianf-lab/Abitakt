# abitakt – Übergabe an eine andere KI (GPT-6, Claude, …)

> Stand: 18.09.2026 (Hauptversion = Codex-Design V2 + Lernbegleiter + alle Claude-Funktionen). Diese Datei reicht, um am Projekt weiterzuarbeiten **oder** eine eigene zweite Version zu bauen, ohne den bisherigen Chat zu kennen.
> Lies zuerst diese Datei, dann `BUILD-GUIDE.md`, dann `index.html`.

---

## 0. Arbeitsregeln für die KI (unbedingt einhalten)

1. **Nur vollständige Dateien oder echte Diffs liefern.** Niemals `/* ... bestehender Code bleibt ... */`, `// Rest unverändert` oder gekürzte Blöcke. Wer das in `index.html` einfügt, löscht die App.
2. **Keine Funktionsnamen raten.** Alle wichtigen Namen stehen in Abschnitt 3. Wenn du etwas brauchst, das dort nicht steht: im Code suchen, nicht erfinden.
3. **Keine Platzhalter-Inhalte als fertig ausgeben.** Keine simulierten KI-Antworten, keine „A/B/C/D“-Fragen, nichts davon im Cache speichern.
4. **Die Engine nicht anfassen** – weder ändern noch per Monkey-Patch (`Engine.x = function…`) überschreiben. Neue Logik kommt *neben* die Engine und liest nur ihre Daten.
5. **Nichts als „✅ fertig“ melden, was nicht getestet ist.** Sag ehrlich, was ungetestet ist.
6. **Nach jeder Änderung:** `node tests/engine-guard.mjs` und `node tests/e2e.mjs` (siehe Abschnitt 6).
7. Oberfläche in DE/EN/TR – jeder neue Text braucht alle drei Sprachen. Lerninhalte bleiben immer Deutsch.

---

## 1. Was abitakt ist

Adaptive Abitur-Lern-Web-App für **Baden-Württemberg** (Abitur 2027), Zielgruppe **volljährige** Schüler:innen.
Unterschied zu simpleclub, StudySmarter, Knowunity, sofatutor usw.: nicht mehr Inhalt, sondern **Anpassung an die einzelne Person** (Schwierigkeit, Tempo, Darstellungsform, Lernzeiten).

- Live: `https://abifix.netlify.app` (Slug ist ein Überbleibsel; der Name ist **abitakt**, nicht „Abifix“)
- Repo: `https://github.com/florianf-lab/Abitakt` (öffentlich)
- Eine einzige Datei `index.html`, kein Build-Schritt, keine Abhängigkeiten. Alle Nutzerdaten bleiben im Browser (`localStorage`).

---

## 2. Dateien

| Datei | Zweck |
|---|---|
| `index.html` | die komplette App (CSS + HTML + JS, ~3000 Zeilen) |
| `BUILD-GUIDE.md` | Architektur, Regeln, Spezifikation der KI-Lektions-Funktion, Roadmap |
| `HANDOFF.md` | diese Datei |
| `tests/engine-guard.mjs` | prüft per SHA-256, dass der Engine-Block unverändert ist |
| `tests/engine.sha256` | erwartete Prüfsumme (nur der Projektinhaber ändert sie) |
| `tests/e2e.mjs` | Browser-Test: volles Onboarding + Session + alle Ansichten in DE/EN/TR, i18n-Vollständigkeit |
| `tests/extra/*.mjs` | Tests für neue Funktionen (werden automatisch von `e2e.mjs` geladen) |
| `package.json` | Abhängigkeiten der Netlify-Funktionen, Test-Skripte |
| `sw.js`, `manifest.webmanifest`, `icons/` | installierbare App, Offline-Modus |
| `netlify.toml` | Netlify-Konfiguration (kein Build-Schritt, Funktionen, Header) |
| `netlify/functions/lesson.mts` | `/api/lesson` – Status abfragen / Generierung anstoßen (Whitelist, Budget, Cache) |
| `netlify/functions/lesson-generate.mts` | Hintergrund-Funktion: erzeugt eine Mathe-Lektion mit Claude, prüft sie, speichert in Netlify Blobs |
| `netlify/functions/open.mts`, `open-generate.mts` | `/api/open` – drei Freitext-Prüfungsaufgaben je Thema (einmal erzeugt, gecacht) |
| `netlify/functions/feedback.mts` | `/api/feedback` – korrigiert eine Freitext-Antwort am Erwartungshorizont |
| `netlify/functions/oral.mts` | `/api/oral` – mündliche Übungsprüfung (fünf Fragen, dann Rückmeldung) |
| `netlify/functions/sync.mts` | `/api/sync` – verschlüsselte Profil-Sicherung (Server speichert nur einen Blob) |
| `netlify/lib/lesson-core.mts` | Themen-Whitelist, Prompt, Tool-Schema, Validierung |
| `netlify/lib/ai-core.mts` | Prompts, Schemata und Validierung für Freitext, Korrektur und mündliche Prüfung |
| `netlify/lib/atomic.mts` | Compare-and-Swap auf Netlify Blobs: Budget-Reservierung und Job-Sperren |
| `tests/server/` | Server-Tests ohne Browser (`npm run test:server`): Budget unter Parallelzugriff, Sperren, `/api/sync` |

---

## 3. Aufbau von `index.html` (echte Namen)

Der Code ist in nummerierte Abschnitte gegliedert (Kommentare `/* ---------- N. … */`).

**1 · Store**
- `BLANK()` – Grundzustand. Felder: `v, lang, name, stage ("welcome"|"app"), cog{pattern,logic,speed,memory,composite}, style{visual,auditory,kinesthetic,textual}, attention{span,overwhelm,restart,novelty}, person{interests,goals,humor}, energy{hourBlock:1..5}, subjects[], progress{}, xp, level, streak, lastActive, log[], rewardState, completedToday[], quick, lastPractice{}`
- `S` – aktueller Zustand; `KEY = "abitakt.v1"`; `Store.save() / load() / reset() / export()`
- `S.subjects[]` = `{ id: "s_<key>", name, tag: "P1"|"P2"|"LF"|"P3"|"P4"|"P5", topics: [{ id, name, exam: "YYYY-MM-DD" }] }`

**2 · Util** – `$`, `app()`, `esc()`, `clamp`, `pct`, `pick`, `sum`, `mean`, `sigmoid`, `shuffle`, `daysUntil(iso)`, `hourLabel(h)`, `toast(html)`.
Klick-Dispatcher: jedes Element mit `data-act="name"` ruft `ACT.name(el, el.dataset)` auf.

**3 · Sprache + Inhalte**
- `LANGS`, `I18N.de/en/tr`, `t(key, vars)`, `setLang(code)`, `langSwitcher()`
- Block **„3a-2“** direkt vor `let LANG` = alle Texte der neuen Funktionen (`Object.assign(I18N.de, {...})` usw.) – neue Texte bitte dort ergänzen.
- Assessment-Aufgaben: `PATTERN`, `LOGIC`, `SPEED`, `STYLE_Q`, `ATT_Q` (**nicht ändern**)
- `INTERESTS` (Interessen mit `scen/obj/objA/who/unit` für das Einweben), `GOALS`, `HUMOR`
- `ABI` (Prüfungsfenster: schriftlich 16.04.–05.05.2027, mündlich 28.06.–08.07.2027)
- `SUBJECTS_BW` – Fächer: `{ l, lf, written, topics: [topicId…] }`, Mathe-Key `mathe` (Subject-ID `s_mathe`)
- `TOPIC_NAMES`, `TOPICS` (drei handgeschriebene Lektionen: `analysis_extrem`, `neuro_ap`, `gesch_teilung` – **nicht ändern**)
- `genericTopic(name, subject)` – ehrlicher Platzhalter für Themen ohne Inhalt
- `getTopic(id)` – **synchron**; wird von der Engine aufgerufen

Lektionsformat:
```js
{ subject, name, load: 1..10, steps: [{ t, visual, auditory, kinesthetic, textual }],
  practice: [{ d: 0..1, q, opts: [4 Strings], a: "<exakt eine Option>", why }] }
```
Platzhalter im Text: `{scen} {obj} {objA} {who} {Who} {unit}` → werden über `Engine.weave()` mit den Interessen ersetzt.
Erlaubte CSS-Klassen im Lektions-HTML: `.visual-box`, `.kinetic-box`, `.audio-box`, `.mono`.

**4 · Adaptive Engine (TABU)** – von `const BLOCKS = [` bis vor `/* ---------- 5. SCREENS`
- `STEEP = 4`, `IDEAL_SUCCESS = 0.78`, `MODES`, `BLOCKS`
- `Engine.rec(id)`, `updateMastery(id, correct, ms, d, mode)`, `targetDifficulty(id)`, `pickPractice(id)`, `pace(id)`, `microSteps(id)`, `modality(id)`, `reward(ctx)`, `blockFor/energyAt/energyNow/peakBlocks`, `allTopics()`, `priority(t)`, `schedule()`, `weave(text, f)`, `composite()`, `dominantStyle()`, `styleBlend()`
- Direkt danach (außerhalb des geschützten Blocks): `Engine.line(kind)`, `Engine.flavor()`

**5 · Screens (Onboarding)**
`scrWelcome` → `ACT.begin` (FLOW.mode="full") → `scrAssessIntro` → Pattern/Logic (`runChoiceQuiz`) → `scrSpeedIntro/renderSpeed` → `scrMemoryIntro/showDigits/askDigits` → `scrCogResult` → `renderStyleQ` → `renderAttQ` → `scrPerson` → `scrEnergy` → `scrAbi` → `ACT.saveAbi` → `scrDone`
- `FLOW` = Zwischenzustand des Onboardings; `FLOW.mode`: `"full" | "quick" | "edit"`
- **Schnellstart:** `ACT.quickStart` → `scrAbi` ohne Fortschrittsbalken → `ACT.saveAbi` setzt `S.quick = true` und startet sofort `ACT.startNext()`. Keine erfundenen Profilwerte.
- `abiFromSubjects()` füllt die Fächerauswahl aus einem bestehenden Plan vor.
- `mount(html, cls)`, `rail(step)`, `L(obj)` (wählt `{de,en,tr}`)

**6 · App-Ansichten**
- `VIEW` = `"dash" | "prog" | "prof"`, `chrome(inner)` (Navigation), `render()`, `ACT.go`
- `profileTodoCard()` – Hinweis „Profil vervollständigen“ für Schnellstart-Nutzer
- `Readiness` – Prüfungsbereitschaft: `topic(id) = mastery × freshness`, Frische halbiert sich alle 21 Tage ohne Übung (min. 0,35). Prüfungsnähe verändert den Wert **nicht**, nur die Reihenfolge in `gaps(n)`.
- `backfillLastPractice()`, `readinessCard()`
- `scrDash()`, `scrProgress()`, `scrProfile()`
- Session: `SES`, `startSession(topicId)`, `renderTeach`, `ACT.nextTeach`, `ACT.switchMode`, `renderPractice`, `ACT.ansPractice` (setzt `S.lastPractice[id]`), `finishSession`, `ACT.quitSession`, `showReward`, `REWARD_TXT`

**7 · Boot** – `boot()`: lädt Zustand, erkennt Sprache, Streak, `backfillLastPractice()`, startet Welcome oder Dashboard.


### 3.8 Ergänzungen (Stand 18.09.2026)

**Design (V2):** helles „Papier & Waldgrün“-Design, mobile Navigation unten (5 Punkte). CSS-Block „Version 2“ am Ende von `<style>`, danach „Coach“-CSS.
Codex-Fixes: Sprachwechsel bleibt in der laufenden Lektion (`refreshSessionLanguage`), Beenden während des Feedbacks springt nicht zurück, Themen ohne Inhalt erzeugen keinen Schein-Fortschritt (`startSession` zeigt „Noch kein Lerninhalt“ + Knopf „Mit eigenen Unterlagen lernen“).

**KI-Lektionen:** Erzeugung in zwei Durchgängen: (1) Lektion schreiben (`emit_lesson`), (2) Fachprüfer rechnet alle 9 Aufgaben neu und korrigiert (`report_review`, `applyReview`); nur geprüfte Lektionen werden gespeichert (Schlüssel `v2/…`). Erster echter Test (17.09.2026): Stochastik LF, ca. 3 Min, Qualität gut, aber ohne Prüfdurchgang 1 falsche Antwort → deshalb der Fachprüfer. `AI_TOPICS`, `AI_CACHE` (`localStorage["abitakt.lessons.v2"]`), `mathLevel(id)`, `aiKey(id)`, `needsAi(id)`, `hasContent(id)`, `openLesson(id)` (lädt vor der Session, Ladebildschirm, Polling alle 5 s), `acceptLesson()` + `cleanHtml()` (Allowlist-Sanitizer), `syncTopicCatalogue()` (neue Themen für alte Profile). `getTopic()` bleibt synchron.

**Operatoren:** `OPERATORS` (21, Bildungsplan BW 2016 Mathe, mit Quelle), `buildOpQuiz(n)`, `scrOperators()`, `S.opStats`.

**Lernbegleiter (Abschnitt 6.6, `Coach`):** alle Daten in `S.life` (`LIFE_DEFAULT()`):
`goals` (Schnitt, Studienwunsch, Warum, Zielpunkte je Fach) · `habits` (Aufschieben 1–5, Handy 1–5, Wunschlänge, Ort, Startritual) · `timetable` · `windows` (Lernzeiten je Wochentag) · `budget`, `breakMins` · `events` (Klausur/Test/Abi/GFS/Abgabe mit Themen) · `tasks` · `curriculum` (now/later/done) · `checkins` (Energie + Hindernis pro Tag) · `sessions` (jede Einheit: geplant/tatsächlich, abgeschlossen, Verzögerung, Bewertung) · `planLog` · `notes`.
- `Coach.candidates(date)` sammelt: Prüfungen (Tagesdosis = geschätzter Restbedarf / verbleibende Tage; Vortag = Generalprobe; Prüfungstag = 10 Min Aktivierung), Aufgaben, Unterrichtsthemen, fällige Wiederholungen, Abitur-Themen (über `Engine.priority`). Jede Einheit hat `why[]` (Begründungen).
- `Coach.plan(date)` legt sie in freie Lernzeiten (Stundenplan ausgespart, Pausen, Tagesbudget), schwere Themen in energiereiche Zeiten, Länge begrenzt durch Wunschlänge, Check-in, Abbrüche, Bewertungen; erste Einheit 10 Min bei Aufschiebe-Neigung (+ Wenn-Dann-Plan).
- `Coach.stats()` = Beobachtungen nur aus echter Nutzung (Abbrüche, typische Dauer, beste Tageszeit nach Trefferquote, Startverzögerung, oft verschobene Fächer). Keine Diagnose.
- UI: `coachNextCard`, `coachCheckinCard`, `coachTimeline`, `coachUpcomingCard`, `setupPromptCard`, Fokus-Timer `startFocus/renderFocus`, `ratingCard`, Planer `scrPlanner` (Tabs events/tasks/week/topics), `aboutForms`, `insightsCard`, Assistent `startWizard/renderWizard`.
- Einheiten mit eigenen Unterlagen zählen als Lernzeit, **nie** als fachlicher Fortschritt.

### 3.9 Ergänzungen (Stand 18.09.2026, zweiter Block)

**Freitext-Aufgaben mit Korrektur (6.7).** `OPEN_TOPICS`, `OPEN_CACHE` (`localStorage["abitakt.open.v1"]`), `openLevel(id)`, `canOpen(id)`, `startOpenTask(id)` (POST `/api/open`, Polling alle 5 s), `renderOpenTask/Grading/Result`, `ACT.openSubmit` (POST `/api/feedback`), `S.openStats[topicId] = {done, points, max, next}`. Die Korrektur bewegt **nie** die Engine-Mastery – sie zählt als Lernzeit (`Coach.record({kind:"open"})`) und als Übung für die Prüfungsbereitschaft (`S.lastPractice`).

**Mündlicher Trainer (6.8).** `startOral(id)`, `oralStep(answer)`, `renderOral()`, `ACT.oralSend/oralQuit/oralAgain`. Fünf Fragen, dann Notenpunkte, Stärken, Lücken, Protokoll. Nur bei Fächern mit Tag P4/P5. Einstieg über `examPracticeCard()` im Dashboard und über den Abschluss einer Lektion.

**Verschlüsselte Sicherung (6.9).** `SYNC` liegt in `localStorage["abitakt.sync.v1"]` = `{id, rev, salt, key, at}` – der abgeleitete Schlüssel, **nie** das Passwort. `deriveKey` = PBKDF2-SHA256, 210 000 Runden; Blob = base64(`salt(16)||iv(12)||ciphertext`), AES-GCM-256. `syncTouch()` hängt an `Store.save()` und lädt entprellt nach 4 s hoch; `syncPush({force})`, `syncPull()`, `applyProfile(data)`. Versionskonflikt → sichtbare Auswahl, kein stilles Überschreiben. Bildschirme `scrSync`, `scrSyncNew`, `scrSyncJoin`, `scrSyncCode`. Zusätzlich `ACT.importProfile` (Profil aus Datei).

**Rechtliche Seiten (6.10).** `OPERATOR` (Name, Anschrift, E-Mail – **muss vor der Veröffentlichung ausgefüllt werden**, sonst warnt die Seite selbst), `scrLegal(tab)` mit `privacy` / `imprint` / `about`, `legalFooterLinks()` im Startbildschirm, `legalCard()` im Profil.

**Dashboard.** `DASH_MORE` klappt Countdown, Stand je Thema, Energiekurve und Prüfungsbereitschaft zusammen (`<details class="dash-more">`).

**Behobene Befunde aus der Codex-Prüfung (17.09.2026).** Budget-Wettlauf und Job-Sperre laufen über `netlify/lib/atomic.mts` (Reservierung **vor** dem Modellaufruf, Rückgabe nur wenn nichts abgerechnet wurde); Sperrfrist 16 Min, harte 13-Min-Frist im Generator; `daysUntil(iso, from)` nimmt einen Bezugstag und `Coach.candidates(date)` übergibt ihn; `Coach.pace()` schätzt aus eigener Median-Dauer und gemessenem Zuwachs und kennzeichnet sich sonst als grob.

**i18n-Blöcke:** „3a-2“ (Schnellstart, Bereitschaft, Operatoren, KI), „3a-3“ (Lernbegleiter), „3a-4“ (Freitext + mündlich), „3a-5“ (Sicherung), „3a-6“ (Rechtliches). Alle drei Sprachen, sonst schlägt der i18n-Test fehl.

---

## 4. Rechtliche und inhaltliche Leitplanken

- Nie „IQ-Test“ – das Assessment ist ein nicht-klinisches Kalibrierungssignal.
- Prüfungstermine immer mit Hinweis „mit der Schule abgleichen“.
- Keine Nähe zum Kultusministerium andeuten.
- Nutzer volljährig; DSGVO gilt trotzdem. Das Aufmerksamkeitsprofil kann als Gesundheitsdatum (Art. 9) gelten → nur lokal speichern, nie an Server schicken.
- Keine Original-Abituraufgaben kopieren.
- Feste „Lerntypen“ sind wissenschaftlich nicht belegt → in der Oberfläche „Darstellungsform“, und die Engine misst, was wirklich wirkt.

---

## 5. Stand

**Fertig und getestet:** alles aus Abschnitt 3, 3.8 und 3.9 (`tests/e2e.mjs` + `tests/extra/05…95`, `npm run test:server`).

**Nur mit simulierten Serverantworten getestet:** Freitext-Korrektur, mündliche Prüfung und die Sicherung sind noch nie gegen den echten Dienst gelaufen.

**Offen:**
1. `OPERATOR` in Abschnitt 6.10 ausfüllen (Name, ladungsfähige Anschrift, E-Mail) – ohne das kein rechtssicheres Impressum.
2. Diesen Stand nach GitHub `main` bringen; die Live-Seite zeigt sonst weiter den alten Stand.
3. Erste echte Läufe von `/api/open`, `/api/feedback`, `/api/oral` mit der Abrechnung abgleichen.
4. Lektionen für die übrigen Mathe-Themen erzeugen und prüfen (Budget 8/Monat).
5. Inhalte für weitere Fächer (bis dahin: Einheiten „mit eigenen Unterlagen“).
6. Optional: Kalender-Export (.ics) für den Tagesplan, Erinnerungen per Push.

## 6. Testen

```bash
npm install            # installiert playwright
npx playwright install chromium
npm test                     # Engine-Wächter + Server-Tests + alle Browser-Tests (ca. 10 Min)
npm run test:server          # nur die Server-Logik (Sekunden, kein Browser)
node tests/e2e.mjs --extra   # nur die Tests neuer Funktionen (ca. 5 Min)
node tests/e2e.mjs --extra --only=70   # nur eine einzelne Testdatei
```

Neue Funktion → neue Datei `tests/extra/NN-name.mjs`:
```js
export default async function ({ newPage, ok, act, click, runSession, fullOnboarding }) {
  const { ctx, page: p } = await newPage("de");
  // ... p ist eine Playwright-Page; ok(bedingung, "Beschreibung")
  ok(p.errors.length === 0, "keine JS-Fehler");
  await ctx.close();
}
```

---

## 7. Wenn du eine eigene, zweite Version baust

- Neuer Dateiname (z. B. `index-v2.html`), das Original bleibt unangetastet.
- Du darfst Design und Aufbau frei wählen, aber: gleiche Leitplanken (Abschnitt 4), gleiche BW-Fächer und Termine (`SUBJECTS_BW`, `ABI`), gleiche drei Sprachen.
- Die Engine-Logik aus Abschnitt 3.4 unverändert übernehmen (sie ist der Kern des Produkts) – oder klar kennzeichnen, was du anders machst und warum.
- Liefere dazu einen eigenen Test wie in Abschnitt 6.
