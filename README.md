# Destiny 2 God Rolls App & Discord Automatisierung

Dieses Repository enthält das **Vite/React Web-Frontend** für Destiny 2 God Rolls und die **Backend-Scraper** (Puppeteer) für das vollautomatische Posten von hochauflösenden Discord-Foreneinträgen.

## 1. Hosting auf GitHub Pages (Webseite)

Die App ist so konfiguriert, dass sie automatisch bei jedem Push auf den `master`-Branch über **GitHub Actions** zu GitHub Pages deployed wird.

### Setup im Repository:
1. Navigiere in deinem GitHub-Repo zu **Settings > Pages**.
2. Wähle unter **Build and deployment > Source** die Option **"GitHub Actions"** aus.
3. Sobald du Änderungen (einschließlich dieser) in den `master`-Branch pushst, startet der Workflow `Deploy to GitHub Pages` automatisch.
4. Deine Seite ist anschließend unter `https://<dein-username>.github.io/<dein-repo-name>/` erreichbar.

*Hinweis zum Routing:* Die App nutzt den `HashRouter`. Deine URLs sehen also so aus: `.../#/de/weapon/123`. Dies garantiert, dass die App auch nach einem Refresh auf Unterseiten reibungslos funktioniert.

### Bungie Login (OAuth2)

Die Webseite bietet einen optionalen **Bungie Login** an, über den Nutzer ihr Destiny-2-Profil und ihre Charaktere anzeigen können. Der Login nutzt den **OAuth2 PKCE-Flow** (kein Backend nötig).

Um den Login zu aktivieren, musst du auf [bungie.net/en/Application](https://www.bungie.net/en/Application) eine App registrieren:
- **OAuth Client Type:** `Public`
- **Redirect URL:** `https://<dein-username>.github.io/<dein-repo-name>/`
- **Scope:** `ReadBasicUserProfile`

Die dabei erhaltene **Client ID** wird als `BUNGIE_CLIENT_ID` Secret im Repository hinterlegt (siehe unten).

## 2. Umgebungsvariablen

Das Projekt nutzt **eine einheitliche Namenskonvention** mit `VITE_`-Prefix für alle Variablen, die sowohl vom Frontend (Vite/Browser) als auch von den Node.js-Scripts verwendet werden.

### Lokale Entwicklung (`.env`)

Kopiere `.env.example` nach `.env` und trage deine Werte ein:

```env
# Shared (Frontend + Backend Scripts)
VITE_BUNGIE_API_KEY=dein_bungie_api_key
VITE_GODROLL_DATABASE_URL=deine_godroll_database_url
VITE_BUNGIE_CLIENT_ID=deine_bungie_oauth_client_id

# Nur Backend (Discord Sync)
DISCORD_WEBHOOK_URL=deine_discord_webhook_url
```

### GitHub Actions (Repository Secrets)

Damit die Actions und das Deployment funktionieren, musst du in deinem GitHub Repository **Repository Secrets** anlegen:

1. Gehe in deinem GitHub-Repo auf **Settings → Secrets and variables → Actions**.
2. Erstelle folgende Secrets:

| Secret | Beschreibung | Verwendet von |
|---|---|---|
| `BUNGIE_API_KEY` | Dein Bungie Developer API Key | Deploy, Manifest Update |
| `BUNGIE_CLIENT_ID` | OAuth Client ID für den Bungie Login | Deploy |
| `GODROLL_DATABASE_URL` | URL zur Godroll Database JSON | Deploy, Manifest Update, Discord Sync |
| `DISCORD_WEBHOOK_URL` | Webhook-URL deines Discord-Forum-Channels | Discord Sync |

> **Hinweis:** In den GitHub Workflows werden die Secrets automatisch auf die `VITE_`-Variablen gemappt (z.B. `BUNGIE_API_KEY` → `VITE_BUNGIE_API_KEY`). Du musst die Secrets **ohne** `VITE_`-Prefix anlegen.

## 3. GitHub Actions (Automatisches Manifest Update)

Das Arsenal und Bungies Manifest ändern sich (z. B. nach dem Weekly Reset am Dienstag). Eine **GitHub Action** lädt das Manifest von Bungie live und speichert es im Repository (`public/destinyData.json`).
Dadurch ist deine Webseite immer und vollautomatisch aktuell!

Die Action läuft automatisch jeden Dienstag um 19:30 UTC. (Oder du drückst unter "Actions" manuell auf *Run workflow*).

Das Skript `npm run sync` pusht dann automatisch einen unsichtbaren Commit in dein Repository, der die Live-Webseite (GitHub Pages) updatet!

## 4. Discord Foren-Automatisierung (Infografiken via GitHub Actions)

Wir nutzen **GitHub Actions**, um hochauflösende Infografiken deiner God Rolls im Glassmorphism-Design zu rendern und vollautomatisch in dein Discord-Forum zu posten. 

Das Rendering (Puppeteer/Chrome) findet direkt auf den GitHub-Servern statt. Ein lokales System wird dafür **nicht** benötigt.

### Funktionsweise:
1. **Smart Polling (Watchdog):** Der Workflow läuft alle 2 Stunden und prüft, ob sich die Godroll Database geändert hat (Hash-Abgleich).
2. **Bedarfsgesteuertes Rendering:** Nur bei Änderungen wird der volle Sync-Prozess (Node.js & Puppeteer) gestartet. Das spart Ressourcen und sorgt für schnellstmögliche Updates.
3. **Rendering:** Puppeteer erstellt ein 1200px breites PNG-Bild für jede Waffe (Deutsch & Englisch).
4. **Discord Post:** Die Bilder werden per Webhook an dein Discord-Forum gesendet. Bestehende Threads werden aktualisiert (**PATCH**), neue Waffen erhalten einen eigenen Thread (**POST**).
5. **Status-Speicherung:** Fortschritt (`discordState.json`) und Hash (`godroll_database_hash.txt`) werden automatisch im Repo gespeichert.

### Manueller Start:
Du kannst den Sync jederzeit manuell anstoßen:
1. Klicke im Repository auf den Tab **Actions**.
2. Wähle links **"Discord Sync (Infographics)"**.
3. Klicke auf den Button **"Run workflow"**.
