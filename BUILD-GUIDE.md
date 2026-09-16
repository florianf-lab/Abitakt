# abitakt – BUILD-GUIDE

> **Neu erstellt am 17.09.2026.** Diese Datei ersetzt die ältere `BUILD-GUIDE.md` (Next.js/Prisma-Variante) **nicht 1:1** – sie beschreibt den *aktuellen* Stand (Einzeldatei + Netlify Functions) und den Plan fürs Agent-Team. Wenn die alte Version wieder auftaucht, Abschnitte daraus bewusst übernehmen statt blind zu mischen.
>
> Diese Datei ist das **gemeinsame Gedächtnis** aller Agents. Jeder Agent liest sie vor jeder Aufgabe.

---

## 1. Produkt in einem Satz

abitakt ist eine adaptive Abitur-Lern-App für Baden-Württemberg, die **den einzelnen Lernenden misst** und Schwierigkeit, Tempo, Darstellungsform und Lernzeiten daran anpasst. Wir konkurrieren **nicht** über Content-Breite (simpleclub, StudySmarter, Knowunity, sofatutor, Studyflix, Learnattack), sondern über Anpassung.

- Zielgruppe: **volljährige** Abiturient:innen in BW (Kursstufe, Abitur 2027)
- Oberfläche: Deutsch, Englisch, Türkisch – Lerninhalte **immer Deutsch** (Prüfungssprache)
- Name: **abitakt** (nicht „Abifix“ – Netlify-Slug `abifix` ist nur ein Überbleibsel)

---

## 2. Aktuelle Architektur

```
abitakt/
├── index.html                 ← die komplette App (kanonische Datei, KEIN abitakt.html)
├── netlify/
│   └── functions/
│       └── lesson.mts         ← Lektions-Generator (MUSS .mts sein, siehe 5.1)
├── tests/                     ← wird NICHT ausgeliefert (siehe netlify.toml)
│   ├── engine.test.mjs        ← Engine-Mathe
│   ├── i18n.test.mjs          ← Übersetzungs-Vollständigkeit
│   ├── ui.e2e.mjs             ← UI-Durchlauf in DE/EN/TR (Playwright)
│   ├── engine-guard.mjs       ← Prüfsumme des Engine-Blocks
│   └── engine.sha256          ← erwartete Prüfsumme
├── agents/
│   ├── TODO.md                ← Aufgabenliste (Planer schreibt, alle lesen)
│   ├── DECISIONS.md           ← Entscheidungen + Begründung
│   └── REPORTS/               ← nächtliche Berichte
├── package.json
├── netlify.toml
└── BUILD-GUIDE.md             ← diese Datei
```

- Kein Build-Schritt für die App selbst. `index.html` bleibt eine selbstständige Datei.
- Netlify deployt automatisch aus `main`.
- Veröffentlicht wird nur das, was die App braucht:

```toml
# netlify.toml
[build]
  publish = "public"
  command = "mkdir -p public && cp index.html public/"

[functions]
  directory = "netlify/functions"
```

---

## 3. Tabu-Zonen (harte Regeln – kein Agent darf das ändern)

| Bereich | Warum |
|---|---|
| `Engine`-Objekt + Konstanten (`STEEP = 4`, `IDEAL_SUCCESS = 0.78`, Lernraten, Belohnungs-Wahrscheinlichkeiten, Scheduler-Gewichte) | Eine stille Änderung verschlechtert die Anpassung, ohne dass etwas sichtbar kaputtgeht |
| Die drei handgeschriebenen Themen `analysis_extrem`, `neuro_ap`, `gesch_teilung` | Qualitäts-Referenz, werden nie überschrieben |
| Aufgabenbanken des kognitiven Assessments | Kalibriert |
| CSS-Designsystem | Nur bestehende Klassen nutzen |
| Onboarding-Ablauf | Änderung nur mit ausdrücklicher Freigabe von Florian (siehe Roadmap 9, Punkt „Schneller Start“) |

Neue Logik (z. B. Wiederholungsmodul) wird **neben** der Engine gebaut und liest nur deren Ausgaben.

### 3.1 Engine-Wächter

`tests/engine-guard.mjs` schneidet den Block von `const Engine = {` bis zur passenden schließenden Klammer aus `index.html` aus, bildet SHA-256 und vergleicht mit `tests/engine.sha256`.

- Abweichung → **Merge blockiert**, egal was sonst grün ist.
- `engine.sha256` darf nur Florian ändern.

---

## 4. Adaptive Engine – was sie tut (Referenz, nicht ändern)

- Elo-artige Beherrschungswerte mit abklingender Lernrate (`STEEP = 4`)
- Zielt auf 78 % Erfolgsquote über eine logistische Schwierigkeitskurve (`IDEAL_SUCCESS = 0.78`)
- Misst pro Thema, welche **Darstellungsform** (visuell/auditiv/handelnd/textlich) tatsächlich mit richtigen Antworten zusammenhängt, und überstimmt die Selbsteinschätzung, sobald Daten widersprechen
- Zerlegt Lernschritte passend zu Aufmerksamkeitsspanne, Überforderungs-Empfindlichkeit und Energie
- Variable Belohnung, garantiert nach einer korrigierten Falschantwort und am Sessionende
- Scheduler: Themen nach (Prüfungsnähe × Lücke), Tageszeiten nach Energie; schwerstes Thema → energiereichster Block

---

## 5. Lektions-Generator (`netlify/functions/lesson.mts`)

### 5.1 Grundsätze

- **`.mts` + moderne Function-Syntax** (`export default async (req) => …`). Nur so injiziert das AI Gateway die Zugangsdaten. Die alte `exports.handler`-Form bekommt keine.
- `new Anthropic()` ohne Key – das Gateway liefert ihn.
- Modell: **Sonnet** (nicht Haiku: Qualität bei Mathe + Grammatik; nicht Opus: Kosten). Modell-ID über Umgebungsvariable `LESSON_MODEL`, damit sie ohne Code-Änderung aktualisiert werden kann.
- Strukturierte Ausgabe **nur** über ein erzwungenes Tool `emit_lesson`. Nie Freitext parsen.
- **Die Lektion ist lernerunabhängig.** Sie wird pro Thema einmal erzeugt und für alle gecacht. Personalisierung passiert im Client:
  - Interessen → Platzhalter `{scen}` `{obj}` `{objA}` `{who}` `{Who}` `{unit}`, die die App ersetzt
  - Schrittgröße/Tempo → macht die Engine
  - Darum schickt der Client **keine** Lernerdaten an die Function (weniger Daten = besser für DSGVO, und der Cache bleibt korrekt).

### 5.2 Anfrage

```json
{ "topicId": "stochastik_binom", "level": "Leistungsfach" }
```

- `topicId` muss in einer **serverseitigen Whitelist** stehen (Kopie der Mathe-Themen aus `SUBJECTS_BW`). Unbekannte IDs → 400. Sonst kann jeder Fremde mit ausgedachten IDs das Budget leeren.
- `level` ∈ `Leistungsfach` | `Basisfach` (Mathe kann beides sein: Tag `P3` = Basisfach, `P1`/`P2`/`LF` = Leistungsfach).
- Themenname und Fach kommen aus der Whitelist, nicht vom Client.

### 5.3 Antwort

```json
{
  "load": 5,
  "steps": [
    { "t": "…", "visual": "<p>…</p>", "auditory": "<p>…</p>",
      "kinesthetic": "<p>…</p>", "textual": "<p>…</p>" }
  ],
  "practice": [
    { "d": 0.35, "op": "berechne", "q": "…",
      "opts": ["…","…","…","…"], "a": "…",
      "why": "…", "wrong": { "…": "typischer Denkfehler hinter dieser Option" } }
  ]
}
```

Neu gegenüber dem ersten Entwurf:
- `op` – BW-Operator der Aufgabe (z. B. `berechne`, `bestimme`, `begründe`, `interpretiere`, `zeige`)
- `wrong` – pro falscher Option der typische Fehler dahinter (für gezieltes Feedback)

Beides ist optional für die App: fehlt es, rendert sie wie bisher.

### 5.4 Inhaltliche Anforderungen (gehen in den Prompt)

- 4–5 Schritte, genau 9 Übungsaufgaben, genau 4 Optionen je Aufgabe
- Schwierigkeiten decken die Spanne ab: mind. eine `d ≤ 0.3`, mind. eine `d ≥ 0.75`
- Jede Darstellungsform ist eine **echt andere Behandlung**, keine Umformulierung:
  - `visual` – Diagramm / Inline-SVG / räumliche Anordnung
  - `auditory` – zum Vorlesen geschrieben, mit wiederholbarem Merksatz
  - `kinesthetic` – Lernende probieren erst selbst, dann kommt die Auflösung
  - `textual` – präzise Prüfungssprache
- Deutsch, Abitur-Niveau, Begriffe des BW-Bildungsplans; Tiefe nach Leistungsfach/Basisfach
- Nur HTML-Fragmente mit bestehenden Klassen: `.visual-box`, `.kinetic-box`, `.audio-box`, `.mono`. Kein Markdown, keine externen Bilder, kein `<script>`.
- Interessen nur einweben, wo es inhaltlich passt (Bahnen, Raten, Optimierung) – nie erzwingen.
- **Keine** Original-Abituraufgaben abschreiben (Urheberrecht). Eigene Aufgaben im Stil der Operatoren.

### 5.5 Validierung

Vor dem Speichern und Zurückgeben:

1. `steps.length` ∈ {4, 5}
2. jeder Schritt: `t` und alle vier Formen nicht leer
3. `practice.length === 9`, jede mit genau 4 **verschiedenen** Optionen
4. `a` ist zeichengenau eine der Optionen
5. `0 ≤ d ≤ 1`, min ≤ 0.3, max ≥ 0.75
6. `load` ganzzahlig 1–10
7. HTML-Filter: kein `<script`, kein `on…=`-Attribut, kein `javascript:`, kein `<img src="http…">`

Fehlschlag → **ein** neuer Versuch → sonst HTTP 502. Kaputte Lektionen werden nie gecacht.

### 5.6 Cache (Pflicht)

- Netlify Blobs, Store `lessons`
- Schlüssel: `v1/{topicId}/{level}` (Level gehört in den Schlüssel – LF und BF sind verschiedene Lektionen)
- Erst Cache lesen, nur bei Miss generieren
- Zusätzlich im Client: `localStorage["abitakt.lessons.v1"]` (getrennt vom Zustand `"abitakt.v1"`)

### 5.7 Budget-Bremse

- Blobs-Store `budget`, Schlüssel `YYYY-MM` → Anzahl Generierungen + geschätzte Kosten
- Überschreitet der Monat `MAX_GENERATIONS_PER_MONTH` (Umgebungsvariable) → HTTP 429, App fällt auf `genericTopic()` zurück
- Pro Thema+Level gleichzeitig nur **eine** Generierung (Sperr-Eintrag im Blob mit Zeitstempel), damit zwei Nutzer nicht doppelt bezahlen

Hintergrund: Netlify Free = 300 Credits/Monat, KI kostet 180 Credits pro 1 $ → ca. 1,67 $ Modellkosten/Monat. Schätzung pro Lektion unter 0,10 $ – **nach der ersten echten Generierung mit der Abrechnung abgleichen** und hier eintragen.

### 5.8 Referenz-Gerüst

```ts
// netlify/functions/lesson.mts
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";

const MATHE_TOPICS: Record<string, string> = {
  // topicId → Themenname, aus SUBJECTS_BW (s_mathe) übernehmen
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method" });

  const { topicId, level } = await req.json().catch(() => ({}));
  const topicName = MATHE_TOPICS[topicId];
  if (!topicName || !["Leistungsfach", "Basisfach"].includes(level)) {
    return json(400, { error: "unknown topic or level" });
  }

  const lessons = getStore("lessons");
  const key = `v1/${topicId}/${level}`;
  const cached = await lessons.get(key, { type: "json" });
  if (cached) return json(200, cached);

  // Budget prüfen (5.7) …

  const client = new Anthropic();
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create(
      {
        model: process.env.LESSON_MODEL!,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: [EMIT_LESSON_TOOL],
        tool_choice: { type: "tool", name: "emit_lesson" },
        messages: [{ role: "user", content: userPrompt(topicName, level) }],
      },
      { signal: AbortSignal.timeout(25_000) },
    );
    const block = msg.content.find((b) => b.type === "tool_use");
    const lesson = block && "input" in block ? block.input : null;
    if (lesson && validateLesson(lesson)) {
      await lessons.setJSON(key, lesson);
      // Budget-Zähler erhöhen …
      return json(200, lesson);
    }
  }
  return json(502, { error: "invalid lesson" });
};

export const config = { path: "/api/lesson" };
```

`SYSTEM_PROMPT`, `EMIT_LESSON_TOOL`, `userPrompt`, `validateLesson` stehen in derselben Datei (Single-File-Prinzip auch hier).

> Timeout beachten: Synchrone Netlify Functions haben ein Zeitlimit. Wenn Generierungen es reißen, auf eine Background Function + Abfrage umstellen oder Lektionen **vorab** erzeugen (Content-Agent, siehe 7).

### 5.9 `package.json`

```json
{
  "name": "abitakt",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node tests/engine-guard.mjs && node --test tests/"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@netlify/blobs": "latest"
  },
  "devDependencies": {
    "playwright": "latest"
  }
}
```

Nach dem ersten Install die Versionen fest eintragen (keine `latest` im Dauerbetrieb).

---

## 6. Anbindung in `index.html`

- `getTopic(id)` bleibt; neu: `async getTopicAsync(id)`
  1. handgeschriebenes Thema in `TOPICS`? → direkt zurück
  2. `localStorage["abitakt.lessons.v1"][id + level]`? → validieren → zurück
  3. Fach ist `s_mathe`? → `POST /api/lesson` → validieren → cachen → zurück
  4. sonst oder bei jedem Fehler → `genericTopic()` wie bisher
- `level` aus dem Tag in `S.subjects`: `P3` → Basisfach, `P1`/`P2`/`LF` → Leistungsfach
- `startSession(topicId)` wird `async`; der `data-act`-Dispatcher verträgt das bereits
- Ladezustand: `focusTop()` + `.card` + bestehende `.screen`-Animation, kein neues CSS
- Neuer i18n-Schlüssel `sess_loading`:
  - DE „Lektion wird vorbereitet…“
  - EN „Preparing your lesson…“
  - TR „Ders hazırlanıyor…“
- Nach Falschantwort: wenn `wrong[option]` existiert, diesen Hinweis zeigen, sonst `why`

---

## 7. Das Agent-Team („Gehirn“)

| Agent | Aufgabe | Darf nicht |
|---|---|---|
| **Planer** | liest `agents/TODO.md`, zerlegt, verteilt, priorisiert | Code schreiben |
| **Builder** | Code auf eigenem Branch `agent/<aufgabe>` | Tabu-Zonen (3) |
| **Content-Agent** | erzeugt Lektionen vorab über `/api/lesson`, Thema für Thema, im Budget | handgeschriebene Themen anfassen |
| **Fachprüfer** | prüft jede Lektion unabhängig: rechnet Lösungen nach, Grammatik, Bildungsplan-Begriffe, echte Unterschiede der 4 Formen, Operatoren | eigene Inhalte ohne Kennzeichnung einschleusen |
| **Test-Agent** | `npm test` + UI-Durchlauf DE/EN/TR nach jeder Änderung | Tests abschwächen, damit sie grün werden |
| **Wächter** | Budget, Rechtsregeln (8), Engine-Prüfsumme, Sicherheit | – |

### 7.1 Ablauf

```
TODO → Planer → Builder / Content-Agent
     → Test-Agent + Fachprüfer + Wächter
     → alle grün?  ja → automatischer Merge nach main → Netlify deployt
                   nein → zurück an Builder (max. 3 Runden, dann Eintrag in REPORTS + Stopp)
```

### 7.2 Harte Merge-Sperren

- Engine-Prüfsumme weicht ab
- ein Test rot
- Monatsbudget überschritten
- verbotene Begriffe in der Oberfläche (siehe 8)

### 7.3 Nachtlauf

- Live-Seite öffnen, UI-Durchlauf in 3 Sprachen, Konsole auf Fehler prüfen
- `/api/lesson` für ein gecachtes Thema aufrufen (kostet nichts)
- Stichprobe: eine gecachte Lektion erneut vom Fachprüfer lesen lassen
- Fehler auf Live → automatisch den letzten grünen Deploy wiederherstellen und melden
- Bericht nach `agents/REPORTS/YYYY-MM-DD.md`: gebaut / getestet / Kosten / offene Probleme

### 7.4 Wann Florian gefragt wird

- neue Zugänge, Server, bezahlte Dienste
- Budget-Erhöhung
- Änderungen an Tabu-Zonen oder am Onboarding
- alles mit Nutzerkonten oder personenbezogenen Daten auf dem Server

---

## 8. Recht & Sicherheit

- **Nie „IQ-Test“.** Das Assessment ist ein Kalibrierungssignal und in der Oberfläche als nicht-klinisch gekennzeichnet.
- **Prüfungstermine** immer mit Hinweis „mit deiner Schule abgleichen“ – Schulen legen die genauen Tage im offiziellen Rahmen fest. Erster schriftlicher Termin im Countdown: 16.04.2027.
- **Keine Nähe zum Kultusministerium** andeuten (keine Logos, kein „offiziell“).
- **Nutzer sind volljährig.** Keine Eltern-Einwilligung nötig – DSGVO gilt trotzdem, sobald ein Backend Nutzerdaten speichert:
  - EU-Hosting, Auftragsverarbeitungsvertrag mit jedem Dienstleister
  - Löschung, die wirklich alles löscht
  - Das **Aufmerksamkeits-/ADHS-bezogene Profil** kann als Gesundheitsdatum (Art. 9 DSGVO) gelten → ausdrückliche Einwilligung, Datenminimierung, möglichst nur lokal speichern
- Aktuell bleiben alle Profildaten im Browser (`localStorage`); die Lektions-Function bekommt keine Profildaten (5.1).
- Keine Original-Abituraufgaben kopieren.

---

## 9. Lern-Prinzipien & Roadmap

### 9.1 Prinzipien (gelten für jede neue Funktion)

- **Abrufen statt Nochmal-Lesen** – jede Session endet mit eigenem Abruf
- **Verteilte Wiederholung** – Stoff kommt zurück, bevor er vergessen ist
- **Gemischt üben** – Themen innerhalb eines Fachs mischen, wenn die Grundlagen sitzen
- **Darstellungsform statt „Lerntyp“** – feste Lerntypen sind wissenschaftlich nicht belegt; wir messen, was funktioniert. Der Quiz ist nur ein Startwert. In der Oberfläche „Darstellungsform“ sagen.
- **Prüfungsnähe** – Operatoren, offene Antworten, Erwartungshorizont
- **Kein Druck-Design** – keine Streak-Schuld, keine nervigen Benachrichtigungen; stattdessen ehrliche Prüfungsbereitschaft
- **Handy zuerst**

### 9.2 Reihenfolge

| # | Paket | Status |
|---|---|---|
| 0 | Inter-Schrift laden (Google-Fonts-Link 400–700); Minimal-Barrierefreiheit: `<nav aria-label>`, `<main>`, `aria-pressed` am Sprachumschalter, `:focus-visible` mit `--line-strong` | geplant |
| 1 | Lektions-Function (5) inkl. Whitelist, Cache, Budget | geplant |
| 2 | Anbindung in `index.html` (6) | geplant |
| 3 | Tests ins Repo + Engine-Wächter | geplant |
| 4 | Operatoren + Fehlerhinweise pro Option | geplant |
| 5 | Wiederholungsmodul neben der Engine | geplant |
| 6 | „Darstellungsform“ statt „Lerntyp“ in DE/EN/TR | geplant |
| 7 | Prüfungsbereitschaft pro Fach (P1–P5) mit den 3 nächsten Lücken | geplant |
| 8 | PWA: installierbar, gecachte Lektionen offline | geplant |
| 9 | Schneller Start (erst Fächer + erste Session, Assessment später in Häppchen) | **wartet auf Florians Freigabe** |
| 10 | Freitext-Aufgaben mit KI-Feedback nach Erwartungshorizont (Tageslimit, kostet pro Antwort) | **wartet auf Florians Freigabe** |
| 11 | Trainer für mündliche Prüfung / Präsentationsprüfung (P4/P5) | später |
| 12 | Weitere Fächer nach Mathe | später |
| 13 | Konten + Sync (Backend, DSGVO-Projekt) | später |

---

## 10. Offene Punkte

- [ ] Repo-Zugang: GitHub-Repo + lokaler Klon verbunden?
- [ ] Liegen die alten Testdateien noch vor, oder neu schreiben?
- [ ] Monatsbudget festlegen (`MAX_GENERATIONS_PER_MONTH`)
- [ ] Aktuelle Sonnet-Modell-ID für `LESSON_MODEL` im Netlify AI Gateway prüfen
- [ ] Erste echte Generierung mit Abrechnung abgleichen und hier eintragen
- [ ] Freigabe für Roadmap 9 und 10
