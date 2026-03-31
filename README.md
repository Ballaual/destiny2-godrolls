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

## 3. Discord Foren-Automatisierung (Infografiken via GitHub Actions)

Wir nutzen **GitHub Actions**, um hochauflösende Infografiken deiner God Rolls im Glassmorphism-Design zu rendern und vollautomatisch in dein Discord-Forum zu posten. 

Das Rendering (Puppeteer/Chrome) findet direkt auf den GitHub-Servern statt. Dein lokales System oder n8n werden dafür **nicht** benötigt.

### Funktionsweise:
1. **Wöchentlicher Sync:** Jeden Dienstag um 20:00 UTC (kurz nach dem Bungie-Reset) startet der Workflow.
2. **Datenabgleich:** Das Skript prüft, ob es neue God Rolls gibt oder ob sich Perks geändert haben (MD5-Hashing).
3. **Rendering:** Puppeteer erstellt ein 1200px breites PNG-Bild für jede Waffe (Deutsch & Englisch).
4. **Discord Post:** Die Bilder werden per Webhook an dein Discord-Forum gesendet. Bestehende Threads werden aktualisiert (**PATCH**), neue Waffen erhalten einen eigenen Thread (**POST**).
5. **Status-Speicherung:** Die Datei `scripts/discordState.json` wird nach jedem Lauf automatisch aktualisiert, damit keine doppelten Posts entstehen.

### Setup für die Discord-Synchronisierung:
Zusätzlich zu den oben genannten Schritten musst du ein weiteres Secret in GitHub anlegen:
1. Gehe zu **Settings -> Secrets and variables -> Actions**.
2. Erstelle ein neues Secret:
   - `DISCORD_WEBHOOK_URL` (Die Webhook-URL deines Discord-Forum-Channels).

### Manueller Start:
Du kannst den Sync jederzeit manuell anstoßen:
1. Klicke im Repository auf den Tab **Actions**.
2. Wähle links **"Discord Sync (Infographics)"**.
3. Klicke auf den Button **"Run workflow"**.
