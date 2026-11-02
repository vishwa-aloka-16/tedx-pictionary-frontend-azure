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
