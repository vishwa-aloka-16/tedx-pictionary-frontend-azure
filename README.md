# TEDx Pictionary frontend for Azure

Standalone React/Vite frontend. The Python game backend and artwork-sharing service
are deployed separately. This repository contains no backend credentials or local
`.env` files. Admin passwords are configured only on the Python backend.

## Local development and production build

Use Node.js 22 (22.12 or newer):

```powershell
npm ci
Copy-Item .env.example .env
```

Set `VITE_API_URL` in `.env` to the public HTTPS origin of your deployed backend
(no trailing slash), then run:

```powershell
npm run dev
# Production:
npm run build
```

The build output is `dist`. This is a static site; no server startup command is
needed on Azure Static Web Apps. Local `.env` files are ignored by Git.
`VITE_*` values are public browser configuration, never secrets.

## Azure Static Web Apps

Create a Free Static Web App and select this repository and branch `main`:

| Setting | Value |
| --- | --- |
| Build preset | Custom |
| App location | `/` |
| API location | Leave blank |
| Output location | `dist` |

The frontend is at the repository root, so do not use `/frontend` as app location.
Keep the generated Azure deployment token and workflow authentication settings.
In the generated GitHub Actions workflow, add this to the Build and Deploy step,
at the same indentation level as `with`:

```yaml
env:
  VITE_API_URL: https://YOUR-BACKEND.azurewebsites.net
```

Replace the placeholder with the actual default domain from your backend's Azure
Overview page. Do not guess it: Azure domains can contain extra generated parts.
For reproducible frontend dependency installation, the deployment step can use
`app_build_command: "npm ci && npm run build"` under its `with` section.
The package engines setting requests Node.js 22 for the build.

Vite embeds `VITE_API_URL` during the build. Changing only Static Web Apps runtime
settings does not update existing JavaScript; rebuild and redeploy after changing
this URL. A local ignored `.env` is not available in a GitHub Actions checkout.

`public/staticwebapp.config.json` is copied into `dist` by Vite. It makes direct
visits and refreshes at `/admin`, `/leaderboard` and `/artwork/*` load `index.html`.

After deployment, copy the Static Web App's public HTTPS origin into the Python
backend's `CORS_ORIGINS` app setting. Retain other allowed origins as a
comma-separated list if needed. Apply backend settings and test two-player games,
leaderboard updates, Admin sign-in and artwork QR downloads.

`VITE_PUBLIC_FRONTEND_URL` is optional. Leave it blank for normal hosted-domain
handling, or set it at build time to your actual frontend public origin if needed
for QR links. Keep the separate image service's publication settings on the backend.

## Checks

```powershell
node --test tests/*.test.js
npm run lint
npm run build
```

## Two-seat queue and reconnect

Only two player seats can be occupied system-wide. Additional players wait in a
FIFO queue and are admitted automatically when a seat is released. On a detected
disconnect, active gameplay pauses and the seat is reserved for 15 seconds.
Both players reconnect through a three-second countdown, retaining the same
round, points and remaining time. On expiry, the unfinished match is cancelled
and the remaining player returns to waiting.

Deploy the updated backend and frontend together. Keep one backend worker and
one instance; queue and active game state live in memory. The backend was
previously deployed manually: pushing this repository alone does not deploy it
unless you have since connected an Azure deployment workflow.

See [queue/reconnect QA notes](docs/QUEUE_AND_RECONNECT_QA.md),
[user flows](docs/HIGH_LEVEL_USER_FLOWS.md),
[scoring rules](docs/QA_SCORING_AND_RULES.md) and
[URLs/endpoints](docs/QA_ENDPOINTS_AND_URLS.md).

## MongoDB leaderboard through the existing Node service

The existing Node/QR service now stores completed game results and player emojis
in MongoDB. Python uses HTTPS through `ARTWORK_SHARE_URL` and the existing
`ARTWORK_SHARE_UPLOAD_KEY`; no PyMongo or new Node environment variables are
needed. With that URL configured, SQLite is the delivery outbox rather than the
leaderboard source. Keep `LEADERBOARD_PATH=/home/data/leaderboard.sqlite3` in Azure
so pending submissions survive restarts. With the URL blank, local SQLite mode
remains available.

Registration prepares both services before joining. Final results show a pending
global ranking until the remote save is confirmed. Duplicate delivery and resets
are generation-safe. Deploy the updated Node service first, then Python, then the
frontend. Existing local SQLite scores are not uploaded automatically.

See the [deployment and optional import guide](docs/LEADERBOARD_SERVICE.md).
