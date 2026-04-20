# VokTest (eigenständige WebApp)

Mobile-first Vokabeltrainer für Englisch (Klasse 6) mit Lernmodus, Quizmodus, Testmodus, Fehleranalyse und Benotung.

## Starten

1. In den Projektordner wechseln:
   ```bash
   cd /Users/Nemesis/Downloads/github/voktest
   ```
2. Lokalen App-Server starten:
   ```bash
   npm run dev
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
- Admin-/Wochenziel-Seite mit serverseitiger Speicherung (API `/api/state`)

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

## Speicherung

Aktuell werden Lernstand, Wochenziele, Admin-Einstellungen und Imports serverseitig in `server-data/state.json` gespeichert.

## Versionsanzeige (Commit)

In `Einstellungen` wird die laufende Version angezeigt (`Version: ...`).

Reihenfolge der Quelle:

1. `.git` im Container (Short-Commit, empfohlen)
2. Datei `VERSION` (Fallback)
3. `APP_VERSION` Env/Fallback

Für Synology ist kein Build-Arg mehr nötig. Wichtig ist nur der Read-Only-Mount von `.git`
in `docker-compose.synology.yml`.

Einfacher Deploy:

```bash
cd /volume2/Docker/voktest
git pull
docker compose -f docker-compose.synology.yml up -d --build
```

## Deployment-Hinweis (wichtig)

Serverseitige Speicherung benötigt einen Node.js-Host (VPS/Cloud/Container).

- **GitHub Pages allein reicht dafür nicht**, da dort keine eigene Backend-API läuft.
- Für produktive Nutzung mit zentralen Daten daher auf Node-fähigem Hosting deployen (z. B. IONOS VPS, Render, Railway, Fly.io).

Hinweise:
- `server-data/state.json` enthält die persistierten Nutzdaten und sollte in Backups enthalten sein.

## Synology (Docker) Schnellstart

Für Self-Hosting auf Synology mit Datei-Persistenz:

- Siehe: [SYNOLOGY-SETUP.md](./SYNOLOGY-SETUP.md)
- Kernpunkt: `server-data` als Docker-Volume mounten, damit `state.json` erhalten bleibt.
