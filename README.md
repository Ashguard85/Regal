# Brettspielregal – GitHub Pages PWA v5.0.0

Statischer Zusatz-Client für **Brettspielregal Docker v5.0.0**. Dieses Paket enthält kein Python, kein SQLite, kein Docker und keine serverseitigen Secrets.

## Betriebsmodi

### Lokal

- alle Brettspiele in IndexedDB
- vollständig ohne Docker-Backend nutzbar
- App-Shell offline verfügbar
- JSON-Backup/Restore lokal
- **keine KI und kein Ollama-Zugriff**

### Server

```text
GitHub Pages PWA
    ↓ HTTPS
Cloudflare Access
    ↓
Brettspielregal Flask API
    ↓
SQLite + optional internes Ollama
```

Ollama wird niemals direkt vom Browser angesprochen. Seine interne URL bleibt dem Pages-Frontend unbekannt.


## Neu in v5

- vollständig überarbeitete iPhone-first Oberfläche
- neue Farbwelt, Sammlungskopf, Suche und Bottom Navigation
- modernere Spielkarten mit Cover bzw. Initialen-Platzhalter
- hervorgehobene Kerninfos und Auszeichnungen
- überarbeitete Formulare, Dialoge, Setup-Bereiche und Offline-Seite
- keine Änderung an IndexedDB, Server-Konfiguration oder gespeicherten Cloudflare-Tokens

## v5 – Oberfläche und Ollama

Wenn das verbundene Docker-Backend `AI_PROVIDER=ollama` verwendet, kann die Pages-PWA im Server-Modus „Daten aus Link vorschlagen“ genau wie das Docker-Frontend nutzen. Der Browser sendet nur die Produkt-URL an das Flask-Backend. Flask lädt die Seite sicher und übergibt den bereinigten Inhalt intern an Ollama.

Im Setup zeigt die PWA den vom Backend gemeldeten KI-Anbieter und Modellnamen. Über „KI-Verbindung testen“ lässt sich prüfen, ob das Backend Ollama und das konfigurierte Modell erreicht. Die interne `OLLAMA_BASE_URL` wird nicht an Pages ausgegeben.

## Server-Verbindung

Im Setup hinterlegen:

- öffentliche Backend-URL, z. B. `https://api.example.com`
- optional `CF-Access-Client-Id`
- optional `CF-Access-Client-Secret`

Cloudflare-Zugangsdaten liegen nur in IndexedDB dieses Geräts. Sie werden nicht exportiert und nach dem Speichern nicht wieder vollständig angezeigt.

## GitHub Pages Konfiguration

`config.js` enthält nur öffentliche Frontend-Konfiguration. Niemals Secrets dort eintragen.

Beispiel:

```js
window.APP_CONFIG = {
  buildTarget: "pages",
  version: "5.0.0",
  defaultApiUrl: "https://api.example.com",
  allowLocalMode: true,
  allowedServerOrigins: ["https://api.example.com"]
};
```

Eine leere `allowedServerOrigins`-Liste erlaubt dem Benutzer, eine beliebige HTTPS-Backend-Origin einzurichten. Für einen festen privaten Einsatz empfiehlt sich eine explizite Liste.

## Daten / Backups

Backup-Format bleibt `brettspielregal-backup` Version 2. v1- und v2-Backups bleiben importierbar. v5 ändert das fachliche Datenmodell nicht.

Ein Moduswechsel synchronisiert keine Daten. „Lokale Daten auf Server übertragen“ und „Serverdaten lokal übernehmen“ sind bewusste, bestätigte Transfers mit Vorschau.

## PWA

- Service Worker `brettspielregal-pwa-v5`
- IndexedDB Schema 2
- kein automatischer Reload bei Service-Worker-Wechsel
- CSP ohne Inline-Scripts/eval
- iPhone Safe Areas und Bottom Navigation

## Cloudflare / CORS

Auf dem Docker-Backend muss `PWA_ALLOWED_ORIGIN` exakt auf die Pages-Origin zeigen. Cloudflare Access muss Browser-`OPTIONS`-Preflights für diese API-Konstellation ermöglichen.

Der Pages-Lokalmodus sendet keine Cloudflare-Header und keine Serverrequests.

## Kompatibilität

**Pages v5.0.0 ↔ Docker v5.0.0**.

Beim Update von Pages v3 auf v5 bleiben IndexedDB-Daten, gespeicherte Backend-URL und gespeicherte Cloudflare-Service-Tokens erhalten.
