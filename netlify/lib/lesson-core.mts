// Shared logic for the lesson functions: topic whitelist, prompt, tool schema, validation.
// Keep MATHE_TOPICS in sync with SUBJECTS_BW.mathe / TOPIC_NAMES in index.html.

export const MATHE_TOPICS: Record<string, string> = {
  stochastik_binom: "Stochastik: Binomialverteilung",
  geometrie_ebenen: "Analytische Geometrie: Ebenen",
  analysis_integral: "Analysis: Integralrechnung",
  analysis_exp: "Analysis: Exponentialfunktionen und Wachstum",
  geometrie_lage: "Analytische Geometrie: Lagebeziehungen von Geraden und Ebenen",
  geometrie_abstand: "Analytische Geometrie: Abstände und Winkel",
};
export const LEVELS = ["Leistungsfach", "Basisfach"] as const;
export type Level = (typeof LEVELS)[number];

export const OPERATORS = ["angeben", "berechnen", "darstellen", "erkennen", "identifizieren", "anwenden",
  "durchführen", "auswerten", "beschreiben", "bestimmen", "deuten", "interpretieren", "entnehmen",
  "erläutern", "erklären", "nutzen", "skizzieren", "untersuchen", "vergleichen", "zuordnen",
  "begründen", "beurteilen", "bewerten", "beweisen", "überprüfen"];

export const lessonKey = (topicId: string, level: string) => `v2/${topicId}/${level}`;   // v2 = with review pass

export const SYSTEM_PROMPT = `Du bist eine erfahrene Mathematik-Lehrkraft an einem allgemeinbildenden Gymnasium in Baden-Württemberg und schreibst Lerneinheiten für die Abiturvorbereitung (Kursstufe, Bildungsplan 2016, Abitur 2027).

Deine Lerneinheit wird in einer adaptiven Lern-App angezeigt. Die App wählt pro Schritt EINE von vier Darstellungsformen aus. Deshalb muss jede Darstellungsform für sich allein vollständig verständlich sein.

Inhaltliche Regeln
- Fachlich absolut korrekt. Rechne jede Aufgabe selbst nach, bevor du sie ausgibst. Lieber eine einfachere, sicher richtige Aufgabe als eine fehlerhafte.
- Begriffe und Schreibweisen wie im BW-Unterricht: z. B. f'(x), Stammfunktion F, Integral, Ortsvektor, Normalenvektor, Koordinatenform, B(n; p), P(X = k), Erwartungswert μ, Standardabweichung σ.
- Leistungsfach: volle Kursstufen-Tiefe inklusive Beweisideen und anspruchsvoller Anwendungen. Basisfach: dieselben Grundideen, weniger Formalismus, einfachere Zahlen, Fokus auf Standardverfahren.
- Keine Original-Abituraufgaben abschreiben. Eigene Aufgaben im Stil des Abiturs, mit den Operatoren aus dem Bildungsplan.
- Sprache: korrektes, klares Deutsch. Siezen in Aufgabenstellungen („Berechnen Sie …“), Duzen in Erklärungen.

Aufbau
- 4 oder 5 Schritte, die aufeinander aufbauen (Einordnen → Kernidee → Verfahren → Anwendung → typische Fehler).
- Jeder Schritt in VIER wirklich verschiedenen Darstellungsformen, keine Umformulierungen:
  - visual: räumlich/grafisch. Nutze inline-SVG (viewBox, einfache Formen, Beschriftung mit <text>, Farben #7d6cf6, #35d6c0, #f2b179, #a2a8bd auf dunklem Hintergrund) oder eine grafisch gegliederte <div class="visual-box">.
  - auditory: zum Vorlesen geschrieben, kurze Sätze, ein wiederholbarer Merksatz in <div class="audio-box">.
  - kinesthetic: die lernende Person probiert ZUERST selbst etwas aus (in <div class="kinetic-box">), erst danach folgt die Auflösung.
  - textual: präzise Prüfungssprache mit Definitionen und sauberer Notation.
- GENAU 9 Übungsaufgaben (nicht 8, nicht 10 – zähle nach) im Multiple-Choice-Format mit genau 4 verschiedenen Antworten. Die richtige Antwort ("a") muss zeichengenau einer der Optionen entsprechen.
- Schwierigkeit "d" zwischen 0 und 1, über die ganze Spanne verteilt: mindestens eine Aufgabe mit d ≤ 0.3 und mindestens eine mit d ≥ 0.75.
- Falsche Optionen sind typische Denkfehler. Erkläre in "wrong" für jede falsche Option den Fehler in einem Satz.
- "op" ist der Operator der Aufgabe und muss aus dieser Liste stammen: angeben, berechnen, darstellen, erkennen, identifizieren, anwenden, auswerten, beschreiben, bestimmen, deuten, entnehmen, erläutern, nutzen, skizzieren, untersuchen, vergleichen, zuordnen, begründen, beurteilen, beweisen, überprüfen.
- Rundungen: Die richtige Option muss exakt dem korrekt gerundeten Ergebnis entsprechen. Erklärungen in "wrong" müssen rechnerisch stimmen – beschreibe nur Denkfehler, die wirklich genau zu dieser Zahl führen.
- "load" = kognitive Last des Themas von 1 (leicht) bis 10 (sehr schwer).

Interessen einweben
Die App ersetzt diese Platzhalter durch Interessen der Lernenden: {scen} (eine Situation, z. B. „der Flugbogen eines Basketballs zum Korb“), {obj} (Nominativ, z. B. „der Ball“), {objA} (Akkusativ, z. B. „den Ball“), {who} / {Who} (eine Person, z. B. „dein Mitspieler“), {unit} (eine Einheit, z. B. „Meter“).
Nutze Platzhalter höchstens in 1–3 Stellen und NUR, wo der Kontext wirklich passt (Bahnen, Änderungsraten, Optimierung, Wachstum, Trefferquoten). Die Sätze müssen grammatisch und inhaltlich mit JEDEM Beispielwert funktionieren – nenne deshalb neben einem Platzhalter nie eine konkrete Sportart, ein Spiel oder ein Instrument. Im Zweifel keine Platzhalter.

Formatregeln
- Nur HTML-Fragmente: <p>, <strong>, <em>, <br>, <ul>, <ol>, <li>, <div>, <span>, <sub>, <sup>, <table>, <tr>, <td>, <th>, <code>, <svg> mit einfachen SVG-Elementen.
- Erlaubte Klassen: visual-box, kinetic-box, audio-box, mono. Keine anderen Klassen.
- Kein Markdown, kein LaTeX, keine Skripte, keine Event-Attribute, keine Links, keine externen Bilder. Formeln mit Unicode (x², √, ∫, π, ≤, ·, →) und <sup>/<sub>.
- Übungsfragen, Optionen und Erklärungen: Text, höchstens mit <sup>, <sub>, <strong>, <em>.

Gib die Lerneinheit ausschließlich über das Werkzeug emit_lesson aus.`;

export const userPrompt = (topicName: string, level: Level) =>
  `Erstelle die Lerneinheit „${topicName}“ für das Fach Mathematik, Niveau: ${level} (Baden-Württemberg, Kursstufe, Abitur 2027).`;

const stepSchema = {
  type: "object",
  properties: {
    t: { type: "string", description: "Kurzer Titel des Schritts" },
    visual: { type: "string" }, auditory: { type: "string" },
    kinesthetic: { type: "string" }, textual: { type: "string" },
  },
  required: ["t", "visual", "auditory", "kinesthetic", "textual"],
};
const practiceSchema = {
  type: "object",
  properties: {
    d: { type: "number", minimum: 0, maximum: 1 },
    op: { type: "string" },
    q: { type: "string" },
    opts: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
    a: { type: "string" },
    why: { type: "string", description: "Warum die richtige Antwort stimmt" },
    wrong: { type: "object", additionalProperties: { type: "string" }, description: "falsche Option -> Denkfehler" },
  },
  required: ["d", "op", "q", "opts", "a", "why", "wrong"],
};
export const EMIT_LESSON_TOOL = {
  name: "emit_lesson",
  description: "Gibt die fertige Lerneinheit strukturiert aus.",
  input_schema: {
    type: "object",
    properties: {
      load: { type: "integer", minimum: 1, maximum: 10 },
      steps: { type: "array", items: stepSchema, minItems: 4, maxItems: 5 },
      practice: { type: "array", items: practiceSchema, minItems: 9, maxItems: 9, description: "Genau 9 Aufgaben" },
    },
    required: ["load", "steps", "practice"],
  },
} as const;

const FORBIDDEN = [/<script/i, /<[^>]*\son\w+\s*=/i, /javascript:/i, /<iframe/i, /<img/i, /<a[\s>]/i, /<link/i, /<style/i,
  /<object/i, /<embed/i, /<foreignObject/i, /<[^>]*\s(?:xlink:)?href\s*=/i, /<[^>]*\ssrc\s*=/i, /url\s*\(/i, /```/, /\$\$/];
const ALLOWED_CLASSES = new Set(["visual-box", "kinetic-box", "audio-box", "mono"]);
const MODES = ["visual", "auditory", "kinesthetic", "textual"] as const;

// Models sometimes return 10–12 items instead of exactly 9. Keep 9 that still span the difficulty range.
export function normalizeLesson(x: any): any {
  if (!x || !Array.isArray(x.practice) || x.practice.length <= 9) return x;
  const items = x.practice.slice().filter((p: any) => typeof p?.d === "number").sort((a: any, b: any) => a.d - b.d);
  if (items.length < 9) return x;
  const pick: any[] = [];
  for (let i = 0; i < 9; i++) pick.push(items[Math.round(i * (items.length - 1) / 8)]);
  return { ...x, practice: pick };
}

export function validateLesson(x: any): string[] {
  const errs: string[] = [];
  if (!x || typeof x !== "object") return ["no object"];
  if (!Number.isInteger(x.load) || x.load < 1 || x.load > 10) errs.push("load");
  if (!Array.isArray(x.steps) || x.steps.length < 4 || x.steps.length > 5) errs.push("steps count");
  (x.steps || []).forEach((s: any, i: number) => {
    if (!s || typeof s.t !== "string" || !s.t.trim()) errs.push(`step ${i} title`);
    for (const m of MODES) {
      const h = s && s[m];
      if (typeof h !== "string" || h.replace(/<[^>]*>/g, "").trim().length < 20) { errs.push(`step ${i} ${m} empty`); continue; }
      if (FORBIDDEN.some(r => r.test(h))) errs.push(`step ${i} ${m} forbidden markup`);
      for (const m2 of h.matchAll(/class\s*=\s*"([^"]*)"/g)) {
        for (const c of m2[1].split(/\s+/).filter(Boolean)) if (!ALLOWED_CLASSES.has(c)) errs.push(`step ${i} ${m} class ${c}`);
      }
    }
    if (s && new Set(MODES.map(m => s[m])).size < 4) errs.push(`step ${i} modalities identical`);
  });
  if (!Array.isArray(x.practice) || x.practice.length !== 9) errs.push("practice count");
  const ds: number[] = [];
  (x.practice || []).forEach((p: any, i: number) => {
    if (!p || typeof p.q !== "string" || !p.q.trim()) errs.push(`q ${i} text`);
    if (typeof p?.d !== "number" || p.d < 0 || p.d > 1) errs.push(`q ${i} d`); else ds.push(p.d);
    if (!Array.isArray(p?.opts) || p.opts.length !== 4 || new Set(p.opts).size !== 4 ||
        p.opts.some((o: any) => typeof o !== "string" || !o.trim())) errs.push(`q ${i} opts`);
    else if (p.opts.filter((o: string) => o === p.a).length !== 1) errs.push(`q ${i} answer not in opts`);
    if (typeof p?.why !== "string" || !p.why.trim()) errs.push(`q ${i} why`);
    // questions may contain only light inline markup (e.g. x<sup>2</sup>)
    if (p && [p.q, p.why, ...(p.opts || [])].some((s: any) => typeof s === "string" && /<(?!\/?(sup|sub|strong|em|b|i|br)\s*\/?>)[a-z\/]/i.test(s))) errs.push(`q ${i} html`);
  });
  if (ds.length && (Math.min(...ds) > 0.3 || Math.max(...ds) < 0.75)) errs.push("difficulty range");
  return errs;
}

// Keep only fields the app uses; drop anything unexpected.
export function cleanLesson(x: any, topicName: string) {
  return {
    subject: "Mathematik", name: topicName, load: x.load, ai: true,
    steps: x.steps.map((s: any) => ({ t: s.t, visual: s.visual, auditory: s.auditory, kinesthetic: s.kinesthetic, textual: s.textual })),
    practice: x.practice.map((p: any) => ({
      d: Math.round(p.d * 100) / 100, op: ALLOWED_OPS.has(String(p.op || "").toLowerCase()) ? String(p.op).toLowerCase() : "", q: p.q, opts: p.opts, a: p.a, why: p.why,
      wrong: Object.fromEntries(Object.entries(p.wrong || {}).filter(([k, v]) => p.opts.includes(k) && k !== p.a && typeof v === "string")),
    })),
  };
}

export const monthKey = () => new Date().toISOString().slice(0, 7);

/* ---- Review pass ("Fachprüfer"): a second model call recomputes every task. ---- */
export const REVIEW_PROMPT = `Du bist Fachprüfer:in für Mathematik (Abitur Baden-Württemberg). Du erhältst eine automatisch erstellte Lerneinheit als JSON.

Prüfe JEDE der 9 Übungsaufgaben, indem du sie selbst vollständig und sorgfältig neu rechnest:
1. Ist die als richtig markierte Antwort "a" mathematisch korrekt (inklusive Rundung)? Genau eine Option darf richtig sein.
2. Stimmt die Begründung "why"?
3. Stimmt jede Erklärung in "wrong" rechnerisch (führt der beschriebene Denkfehler wirklich zu genau dieser Zahl)? Falls nicht: formuliere eine zutreffende Erklärung oder schreibe "Typischer Rechen- oder Rundungsfehler."
4. Ist "op" ein Operator aus der BW-Liste (angeben, berechnen, darstellen, erkennen, identifizieren, anwenden, auswerten, beschreiben, bestimmen, deuten, entnehmen, erläutern, nutzen, skizzieren, untersuchen, vergleichen, zuordnen, begründen, beurteilen, beweisen, überprüfen)?

Korrigiere Fehler direkt: Passe Optionen, "a", "why", "wrong", "op" so an, dass alles stimmt (4 verschiedene Optionen, "a" zeichengenau eine davon, Platzhalter wie {who} unverändert lassen, Schwierigkeit "d" beibehalten).
Prüfe außerdem die Erklärtexte der Schritte auf fachliche Fehler. Setze "steps_ok" nur dann auf false, wenn dort ein echter inhaltlicher Fehler steht.

Gib das Ergebnis ausschließlich über das Werkzeug report_review aus: alle 9 (korrigierten) Aufgaben in der ursprünglichen Reihenfolge.`;

export const REVIEW_TOOL = {
  name: "report_review",
  description: "Gibt die geprüften und korrigierten Übungsaufgaben zurück.",
  input_schema: {
    type: "object",
    properties: {
      problems: { type: "array", items: { type: "string" }, description: "Gefundene Fehler (kurz), leer wenn alles stimmt" },
      steps_ok: { type: "boolean", description: "false nur bei inhaltlichem Fehler in den Erklärschritten" },
      practice: { type: "array", items: practiceSchema, minItems: 9, maxItems: 9 },
    },
    required: ["problems", "steps_ok", "practice"],
  },
} as const;

export function applyReview(lesson: any, review: any): { lesson: any; ok: boolean; problems: string[] } {
  const problems: string[] = Array.isArray(review?.problems) ? review.problems.map(String).slice(0, 20) : [];
  if (!review || review.steps_ok === false) return { lesson, ok: false, problems: problems.concat(["steps not ok"]) };
  if (!Array.isArray(review.practice) || review.practice.length !== 9) return { lesson, ok: false, problems: problems.concat(["review incomplete"]) };
  const practice = review.practice.map((p: any, i: number) => ({ ...p, d: typeof p.d === "number" ? p.d : lesson.practice[i]?.d }));
  return { lesson: { ...lesson, practice }, ok: true, problems };
}

export const ALLOWED_OPS = new Set(["angeben", "berechnen", "darstellen", "erkennen", "identifizieren", "anwenden", "durchführen",
  "auswerten", "beschreiben", "formulieren", "bestimmen", "erschließen", "deuten", "interpretieren", "entnehmen", "erläutern",
  "erklären", "nutzen", "verwenden", "skizzieren", "untersuchen", "vergleichen", "zuordnen", "begründen", "beurteilen",
  "bewerten", "beweisen", "überprüfen"]);
