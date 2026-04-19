# VokTest (eigenständige WebApp)

Mobile-first Vokabeltrainer für Englisch (Klasse 6) mit Lernmodus, Quizmodus, Testmodus, Fehleranalyse und Benotung.

## Starten

1. In den Projektordner wechseln:
   ```bash
   cd /Users/Nemesis/Downloads/github/voktest
   ```
2. Lokalen Server starten (Beispiel):
   ```bash
   python3 -m http.server 5173
   ```
3. Im Browser öffnen:
   ```
   http://localhost:5173
   ```

Hinweis: Für iPhone/iPad im selben WLAN mit `http://<deine-ip>:5173` öffnen und dann zum Home-Bildschirm hinzufügen.

## Enthalten in v1

- Lernmodus (Antwort anzeigen, Selbstbewertung)
- Quizmodus (Multiple Choice)
- Testmodus (freie Eingabe)
- Punkte, Streak, Trefferquote, Note (1-6)
- Level-/XP-System mit Fortschrittsbalken
- Große Feedback-Karten und Mini-Erfolgsanimation bei richtigen Antworten
- Fehlerliste pro Runde und Wiederholen von Fehlervokabeln
- Lokaler Verlauf (LocalStorage)
- Import eigener Vokabeln per JSON oder CSV
- OCR-Import aus Foto (Kamera/Galerie) mit Mehrfachscan (Original, Kontrast, Rotation)
- Lernfortschritt-Reset (Verlauf, Fehlerstatistik, XP/Level)
- PWA-Grundlage (Manifest + Service Worker)
- Geführte Tab-Navigation: `Start` (Begrüßung + Modus + Start), `Üben`, `Verlauf`, `Einstellungen`

## Projektstruktur (modular)

```text
voktest/
  app.js                     # App-Orchestrierung (Settings, Session, Navigation)
  modules/
    common.js                # gemeinsame Utilities (Antwortprüfung, Noten, Labels)
    history-module.js        # Verlauf + Auswertung
    import-module.js         # JSON/CSV-Import + OCR-Import
  data/vocabulary.js         # Startdatensatz
  index.html                 # UI-Struktur (Bereiche)
  styles.css                 # Design und responsive Layout
```

## OCR-Import (Foto)

1. In der App in `Einstellungen` im Bereich `Vokabeln importieren` ein Foto wählen.
2. `Foto scannen (OCR)` klicken.
3. Die App versucht mehrere OCR-Varianten (Original/Kontrast/Rotation) und übernimmt das beste Ergebnis.
4. Kurz prüfen und `Importieren` klicken.

Hinweise:
- Beim ersten OCR-Lauf wird die OCR-Bibliothek aus dem Internet geladen.
- Falls ein Foto schwer erkennbar ist: iOS Live Text in der Fotos-App nutzen, Text kopieren und als CSV einfügen.

## Import-Formate

### CSV

Eine Zeile pro Vokabel:

```text
to run;joggen;Unit 4;Lesson B;249
```

Schema:

```text
english;german;unit;lesson;page
```

### JSON

```json
[
  {
    "english": "to run",
    "german": "joggen",
    "unit": "Unit 4",
    "lesson": "Lesson B",
    "page": 249
  }
]
```

## Deployment: GitHub Pages + IONOS-Domain

Empfohlen: eigene Subdomain, z. B. `vokabeln.deinedomain.de`.

1. Neues GitHub-Repository anlegen (leer, z. B. `voktest`).
2. Dieses Projekt in das Repo pushen (inkl. `.github/workflows/deploy-pages.yml`).
3. In GitHub: `Settings -> Pages -> Source: GitHub Actions`.
4. In IONOS DNS:
   - Record-Typ: `CNAME`
   - Hostname: `vokabeln` (oder Wunschname)
   - Ziel: `<dein-github-user>.github.io`
5. In diesem Projekt Datei `CNAME` anlegen (oder `CNAME.example` kopieren) mit genau:
   - `vokabeln.deinedomain.de`
6. Commit + Push. Nach dem Action-Lauf ist die App unter der Domain erreichbar.

Hinweise:
- DNS kann bis zu 15-60 Minuten brauchen.
- HTTPS stellt GitHub Pages automatisch bereit, sobald DNS korrekt ist.
