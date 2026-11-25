# Overzicht

A personal overview app for a school scrum project. Open it whenever you finish
something and wonder "what now?". The screens are in Dutch.

- **Wat nu?** Deadline countdowns, how much time you logged today and when your last
  activity ended, check-ins (WhatsApp, issue board, merge requests, plus your own),
  your GitLab issues and your own to-do's.
- **Tijd** A week calendar of the time you logged with *tijdregistratie*. Clicking an
  entry opens its commit in GitLab.
- **Instellingen** Manage check-ins and deadlines, and see the GitLab connection.

## GitLab is read-only

The app reads from the school GitLab (time entries in `.timetracking/YYYY/MM/*.json`
on `develop`, issues, merge requests) and **never writes to it**. The GitLab client
can only send `GET` requests, and a test checks that. Use a token with only the
`read_api` scope.

## Run it with Docker

1. Create a personal access token in GitLab with only the **read_api** scope.
2. Copy `.env.example` to `.env` and fill in `GITLAB_TOKEN` (the project path is already set).
3. Start it:

   ```bash
   docker compose up -d --build
   ```

4. Open <http://localhost:8080>.

Stop it with `docker compose stop` (or the stop button in Docker Desktop).
Your check-ins, deadlines and to-do's are kept in the `overzicht-data` volume.

To try it without GitLab, set `DEMO=1` in `.env`.

`.env` holds your token and is in `.gitignore`. Never commit it.

## Develop

Requires Node 22.18 or newer (the server runs TypeScript directly, no extra dependencies).

```bash
npm install
npm run server:demo   # API on :8080 with example data (or: npm run server, uses .env)
npm run dev           # web app on :5173, proxies /api to :8080
npm test
npm run build
```

```
server/   Node HTTP server: GitLab client (GET only), time entries, check-ins, local data store
shared/   Types used by server and web app
src/      React web app (views: WatNu, Tijd, Instellingen)
```
