---
name: lektion-pruefen
description: Eine KI-Lektion von abitakt erzeugen lassen und fachlich prüfen, bevor Schüler sie sehen. Use when ein neues Mathe-Thema freigeschaltet oder eine Lektion neu erzeugt wird.
---

# Lektion erzeugen und prüfen

1. **Erzeugen anstoßen** (kostet Credits, ca. 3 Min, läuft im Hintergrund):

   ```bash
   curl -s -X POST https://abifix.netlify.app/api/lesson \
     -H 'Content-Type: application/json' \
     -d '{"topicId":"<THEMA>","level":"Leistungsfach"}'
   ```

   Gültige Themen stehen in `netlify/lib/lesson-core.mts` (`MATHE_TOPICS`).

2. **Warten und Status abfragen**, alle 30 Sekunden, höchstens 6-mal:

   ```bash
   curl -s 'https://abifix.netlify.app/api/lesson?topicId=<THEMA>&level=Leistungsfach'
   ```

   `pending` = läuft, `ready` = fertig, `failed` = zweimal ungültig (Logs in Netlify unter
   Functions → lesson-generate ansehen).

3. **Fachlich prüfen**: den `fachpruefer`-Subagenten auf die fertige Lektion ansetzen.
   Er rechnet jede Aufgabe neu. Der eingebaute Prüfdurchgang ersetzt diese Kontrolle nicht,
   solange noch wenige Lektionen erzeugt wurden.

4. **Bei Fehlern**: nicht im gespeicherten JSON herumkorrigieren. Stattdessen den Prompt in
   `netlify/lib/lesson-core.mts` schärfen, hochladen und die Lektion neu erzeugen lassen
   (dafür muss der Cache-Schlüssel `lessonKey` erhöht werden – das erzwingt eine Neu-Erzeugung
   **aller** Lektionen und kostet entsprechend).

5. **Ergebnis festhalten**: kurzer Eintrag in `STAND.md`, welche Lektion geprüft wurde und was auffiel.
