# Synology Setup (Docker/Container Manager)

## Ziel

VokTest auf einer Synology NAS als Docker-Container laufen lassen, mit persistenter Datei-Speicherung in:

- `server-data/state.json`

Damit bleiben Vorgaben/Fortschritt/Admin-Daten nach Neustarts erhalten.

## Voraussetzungen

- DSM 7.x mit **Container Manager**
- Eigene Domain/Subdomain (optional, empfohlen)
- Port-Forwarding im Router (mind. 80/443 für HTTPS via Reverse Proxy)

## 1) Projekt auf die NAS kopieren

1. Lege auf der NAS z. B. diesen Ordner an:
   - `/volume1/docker/voktest`
2. Kopiere den kompletten Projektinhalt dort hinein.
3. Prüfe, dass der Ordner `server-data` vorhanden ist.

## 2) Container starten (SSH, schnellster Weg)

Per SSH auf der NAS:

```bash
cd /volume1/docker/voktest
docker compose -f docker-compose.synology.yml up -d --build
```

Prüfen:

```bash
docker ps | grep voktest
curl -sSf http://127.0.0.1:5173/api/state
```

## 3) Reverse Proxy + HTTPS in DSM

In DSM:

1. `Systemsteuerung -> Anmeldeportal -> Erweitert -> Reverse Proxy`
2. Neue Regel:
   - Quelle:
     - Protokoll: `HTTPS`
     - Hostname: z. B. `voktest.deinedomain.de`
     - Port: `443`
   - Ziel:
     - Protokoll: `HTTP`
     - Hostname: `127.0.0.1`
     - Port: `5173`
3. Zertifikat (Let’s Encrypt) zuweisen:
   - `Systemsteuerung -> Sicherheit -> Zertifikat`
4. DNS-A-Record der Subdomain auf deine öffentliche IP setzen.

## 4) Updates einspielen

Nach Code-Änderungen:

```bash
cd /volume1/docker/voktest
git pull
docker compose -f docker-compose.synology.yml up -d --build
```

## 5) Backup

Wichtigster Pfad:

- `/volume1/docker/voktest/server-data/state.json`

Diesen Pfad regelmäßig mit Hyper Backup oder Snapshot Replication sichern.

## Troubleshooting

- `state.json` wird nicht geschrieben:
  - Prüfe Volume-Mount in `docker-compose.synology.yml`.
  - Prüfe Ordnerrechte auf `/volume1/docker/voktest/server-data`.
- Seite erreichbar, aber keine Daten bleiben:
  - Container läuft ohne korrektes Volume (ephemeres Dateisystem).
- Domain geht nicht:
  - DNS propagiert noch oder Router-Portweiterleitung fehlt.
