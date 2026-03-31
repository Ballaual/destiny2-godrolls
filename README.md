# Destiny 2 God Rolls App & Discord Automatisierung

Dieses Repository enthält das **Vite/React Web-Frontend** für Destiny 2 God Rolls und die **Backend-Scraper** (Puppeteer) für das vollautomatische Posten von hochauflösenden Discord-Foreneinträgen.

## 1. Hosting auf GitHub Pages (Webseite)

Die App ist so konfiguriert, dass sie automatisch bei jedem Push auf den `master`-Branch über **GitHub Actions** zu GitHub Pages deployed wird.

### Setup im Repository:
1. Navigiere in deinem GitHub-Repo zu **Settings > Pages**.
2. Wähle unter **Build and deployment > Source** die Option **"GitHub Actions"** aus.
3. Sobald du Änderungen (einschließlich dieser) in den `master`-Branch pushst, startet der Workflow `Deploy to GitHub Pages` automatisch.
4. Deine Seite ist anschließend unter `https://<dein-username>.github.io/<dein-repo-name>/` erreichbar.

*Hinweis zum Routing:* Die App nutzt nun den `HashRouter`. Deine URLs sehen also so aus: `.../#/de/weapon/123`. Dies garantiert, dass die App auch nach einem Refresh auf Unterseiten reibungslos funktioniert.

## 2. GitHub Actions (Automatisches Manifest Update)

Das Arsenal und Bungies Manifest ändern sich (z. B. nach dem Weekly Reset am Dienstag). Wir haben eine **GitHub Action** eingerichtet, die das Manifest von Bungie live lädt und stetig im Repository speichert (`public/destinyData.json`).
Dadurch ist deine Webseite immer und vollautomatisch aktuell!

### Setup für GitHub Actions:
Damit die Action die Daten von Bungie abrufen kann, musst du in deinem GitHub Repository zwei **Repository Secrets** anlegen:
1. Gehe in deinem GitHub-Repo auf **Settings -> Secrets and variables -> Actions**.
2. Erstelle »New repository secret«:
   - `BUNGIE_API_KEY` (Dein Bungie Developer API Key)
   - `LITTLELIGHT_URL` (Die URL zum LittleLight JSON)
3. Die Action läuft von nun an automatisch jeden Dienstag um 19:30 UTC. (Oder du drückst unter "Actions" manuell auf *Run workflow*).

Das Skript `npm run sync` pusht dann automatisch einen unsichtbaren Commit in dein Repository, der die Live-Webseite (GitHub Pages) updatet!

## 3. n8n Einbindung (Discord Bilder-Posten)

Der letzte, wichtigste Schritt: Wie kriegst du n8n dazu, die schweren `Puppeteer` Discord-Bilder zu rendern und in dein Forum zu schießen? 

Da dein Manifest nun durch GitHub immer aktuell gehalten wird, beschränkt sich die Aufgabe deines lokalen n8n-Servers auf das Abgleichen und Posten!

### n8n Workflow-Aufbau:

1. **Trigger Node (Cronjob):**
   - Wähle den Token `Schedule Trigger`.
   - Setze die Frequenz (z. B. 1x wöchentlich am Dienstag um 19:50 Uhr – kurz *nachdem* Git das Update gemacht hat).

2. **Execute Command Node (Repository Clonen/Pullen):**
   - Damit n8n die nagelneue `destinyData.json` aus GitHub hat, musst du das Projektverzeichnis aktualisieren.
   - Command: `git pull origin main` (Wenn dein Projekt bereits im Container-Dateisystem liegt) 
   - *Tipp:* Wenn n8n absolut keinen Zugriff auf Git hat, kannst du alternativ die generierte `.json` über n8n via HTTP-Node herunterladen.

3. **Execute Command Node (Discord Synchronisierung):**
   - Verbinde den Erfolgs-Output (Success) vom vorherigen Command.
   - Command: `npm run discord-sync`
   - **Tipp für die `.env` / Sicherheit:** Anstatt Keys im Code stehen zu haben, übergib dem n8n-Container in seiner Server-Umgebung (Docker) einfach die `.env` Variablen (`DISCORD_WEBHOOK_URL`, `LITTLELIGHT_URL`). Das Puppeteer-Skript greift automatisch darauf zu!

Das Skript vergleicht dann leise die MD5-Hashes in der `discordState.json` und schickt ausschließlich neue oder veränderte XXL-Bilder in atemberaubender Glassmorphism-Optik über deinen Webhook ans Forum (als **PATCH** zu alten Threads, oder als neue Posts!).
