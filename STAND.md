# Arbeitsstand – 18.09.2026

Live: https://abifix.netlify.app (Netlify deployt automatisch aus GitHub `main`).
Der Stand unten ist auf GitHub und live.

Fertig und getestet (Browser-Tests mit simulierten Serverantworten):
- Design V2, Lernbegleiter (Alltag, Check-in, Tagesplan mit Begründung, Planer, Fokus-Timer,
  Bewertung, Beobachtungen), Schnellstart, Prüfungsbereitschaft, Operatoren, Offline-App
- Sechs handgeschriebene Lektionen: Analysis, Aktionspotential, Proteinbiosynthese, Erörterung,
  Nationalsozialismus 1933–1945, Deutschland 1945–1990
- KI-Lektionen mit Fachprüfer-Durchgang; eine echte Lektion (Stochastik LF) erzeugt und nachgerechnet
- Freitext-Aufgaben im Abiturformat mit Korrektur am Erwartungshorizont (`/api/open`, `/api/feedback`)
- Mündlicher Prüfungstrainer P4/P5 (`/api/oral`)
- Verschlüsselte Profil-Sicherung ohne Konto (`/api/sync`), Profil-Import aus Datei
- Stolpersteine: falsche Antworten werden gesammelt und lassen sich gezielt nachüben
- Kalender-Export (.ics) für Tagesplan, Termine und Aufgaben
- Datenschutz, Impressum und „Über abitakt“ als eigene Seiten in DE/EN/TR
- Budget-Reservierung und Job-Sperren per Compare-and-Swap (`netlify/lib/atomic.mts`)
- Icons, Theme-Farbe und Teilen-Vorschau im Papier-/Waldgrün-Design
- Agent-Setup im Repo: CLAUDE.md, .claude/agents, .claude/skills/lektion-pruefen, Hook

Offen:
1. `OPERATOR` in `index.html` (Abschnitt 6.10) ausfüllen – ohne Angaben ist das Impressum unvollständig
3. Erste echte Läufe der neuen Endpunkte mit der Abrechnung abgleichen
4. Lektionen für die übrigen Mathe-Themen erzeugen und prüfen (Budget 8/Monat)
5. Ideen aus Florians TikTok-Videos (Inhalt muss Florian beschreiben)
6. Inhalte für weitere Fächer
