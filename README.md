# Brettspielregal – GitHub Pages PWA v1.0.0

Dieses Paket ist das **rein statische Zusatz-Frontend** für GitHub Pages. Es enthält kein Python, Flask, SQLite, Docker oder serverseitige Secrets. Release-Kompatibilität: **Pages v1.0.0 ↔ Docker v1.0.0**.

## Betriebsmodi

### Lokal

Alle Brettspiele liegen in IndexedDB auf diesem Gerät. Nach erfolgreichem ersten Laden/Cache-Befüllen ist die App-Shell offline nutzbar. Es gibt keine Backend-URL, kein Cloudflare-Token und keine Serverrequests. JSON-Backup/Restore funktioniert lokal.

### Server

Die PWA verwendet die REST-API des Docker-Pakets über eine öffentliche HTTPS-URL, z. B. `https://api.example.com`. Daten liegen dann in der SQLite-Datenbank des Docker-Backends.

Beim Moduswechsel wird **nur der aktive Datenspeicher gewechselt**. Es gibt keinen Fake-Sync. Die Aktionen „Lokale Daten auf Server übertragen“ und „Serverdaten lokal übernehmen“ sind bewusste Importvorgänge mit Vorschau und Auswahl zwischen Zusammenführen/Ersetzen.

## Erststart

Beim ersten Start fragt die PWA:

- Auf diesem Gerät → lokaler Modus
- Mit meinem Server → Server-Modus

Der Modus kann später unter Setup geändert werden.

## Server-Konfiguration

Im Server-Modus werden lokal auf dem Gerät gespeichert:

- Backend URL
- Cloudflare Client ID
- Cloudflare Client Secret

Backend-URL liegt in IndexedDB `settings`, Service-Token-Werte in einem getrennten IndexedDB-Store `secrets`. Sie werden nie in JSON-Backups aufgenommen. Das Secret wird nach Speicherung nicht wieder vollständig angezeigt und kann ohne Neuinstallation gelöscht/ersetzt werden.

Nur öffentliche `https://`-Backend-URLs sind vorgesehen.

## Cloudflare Access / CORS

Das Docker-Backend erwartet für Pages als Origin beispielsweise:

```text
PWA_ALLOWED_ORIGIN=https://app.example.com
```

Für Service Auth sendet die PWA im Server-Modus:

```text
CF-Access-Client-Id
CF-Access-Client-Secret
```

Diese Custom Headers lösen im Browser einen CORS-Preflight aus. In Cloudflare Access muss deshalb für die API-Anwendung entweder `OPTIONS` zum Origin durchgelassen oder die Preflight-Antwort in Cloudflare konfiguriert werden. Der Origin selbst erlaubt weiterhin nur die exakt konfigurierte Pages-Origin.

Empfehlung: separates Service Token pro Gerät, kurze/angemessene Laufzeit, engste Access-Policy und einzelne Widerrufbarkeit. Ein Browser-PWA-Secret ist **kein** iOS-Keychain-Secret; JavaScript derselben Origin kann darauf zugreifen.

## Content Security Policy

Die mitgelieferte CSP verbietet fremde Scripts, Inline-Scripts, `eval`, Frames und Objekte. Weil die Backend-URL beim Erststart frei konfigurierbar sein kann, ist `connect-src` in v1 auf HTTPS-Verbindungen beschränkt (`https:`), nicht auf einen einzelnen Host.

Wenn die Backend-Origin feststeht, ist eine weitere Härtung empfehlenswert: in `index.html` `connect-src 'self' https:` durch die konkrete Origin ersetzen, z. B. `connect-src 'self' https://api.example.com`.

## IndexedDB

Datenbank: `brettspielregal-local`, Schema-Version 1.

Stores:

- `games` – lokale fachliche Datensätze
- `settings` – kleine nicht-geheime PWA/Verbindungseinstellungen
- `secrets` – Cloudflare-Zugangsdaten; nicht exportiert

Künftige Releases müssen die IndexedDB-Version erhöhen und bestehende Daten migrieren statt die DB zu löschen.

## Backup / Restore

Gemeinsames Format:

```json
{
  "format": "brettspielregal-backup",
  "version": 1,
  "data": {"games": [], "settings": {}}
}
```

Im lokalen Modus werden fachliche Daten exportiert. Cloudflare-Zugangsdaten und Server-Konfiguration sind ausdrücklich nicht Bestandteil des Backups.

Beim Restore erscheint zuerst eine Vorschau. „Ersetzen“ löscht den Zielbestand, „Zusammenführen“ behält andere IDs und übernimmt importierte IDs. Beim Übernehmen von Serverdaten kann vor einem lokalen Ersetzen ein Sicherheitsbackup exportiert werden.

## Link-/KI-Auswertung

Die Auswertung externer Links ist absichtlich **nicht lokal im Pages-Browser** implementiert, weil dort kein KI-API-Key sicher hinterlegt werden soll. Sie erscheint nur im Server-Modus, wenn das Docker-Backend `AI_IMPORT_ENABLED=true` meldet. Der externe Abruf und ein optionaler OpenAI-Aufruf erfolgen dann serverseitig.

## GitHub Pages Deployment

Das Paket kann direkt in die Root eines Git-Repositories kopiert werden. Der Workflow `.github/workflows/pages.yml` lädt den Repository-Inhalt als Pages-Artefakt hoch. In GitHub unter **Settings → Pages → Source** GitHub Actions wählen.

Es werden keine Secrets im Workflow benötigt.

## iPhone / PWA

Die Oberfläche ist auf Hochformat, Safe Areas, Bottom Navigation und Touch-Ziele ausgelegt. Manifest, Apple Touch Icon, 192/512/Maskable Icons sowie Offline-Fallback sind enthalten. Zum Installieren in Safari: Teilen → „Zum Home-Bildschirm“.

## Service Worker

Cache-Version v1: `brettspielregal-pwa-v1`. Es gibt keine erzwungene Reload-Schleife bei `controllerchange`. Bei einer Frontend-Änderung muss die Cache-Version erhöht werden.

## Bekannte Einschränkungen v1

- keine automatische Synchronisation
- kein Offline-Schreiben im Server-Modus
- bei gelöschten Browser-/PWA-Daten gehen lokale IndexedDB-Daten verloren
- Service Token im Browser bietet nicht die Schutzstufe nativer Secure Storage
- frei konfigurierbare Backend-URL erfordert für CSP `connect-src https:`; bei fixer Origin sollte die CSP enger gesetzt werden
