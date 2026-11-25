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

The app reads from the school GitLab (time entries in `.time-tracking/YYYY/MM/*.json`
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

## Op je telefoon (via Tailscale)

Zo open je de app op je telefoon, thuis of onderweg, zonder dat hij op internet komt te staan.
Tailscale maakt een privénetwerk tussen jouw eigen apparaten. Alleen apparaten die met jouw
Tailscale-account zijn ingelogd kunnen de app bereiken. `docker-compose.yml` blijft gewoon op
`127.0.0.1:8080` staan; Tailscale stuurt het verkeer door naar die poort op je MacBook.

**Eenmalig instellen**

1. **MacBook:** installeer Tailscale via <https://tailscale.com/download/mac> (of de Mac App Store),
   open het en log in (bijv. met je Google- of GitHub-account). Het Tailscale-icoon verschijnt in de menubalk.
2. **Telefoon:** installeer de Tailscale-app (App Store of Google Play), log in met **hetzelfde account**
   en zet de schakelaar aan.
3. **Admin console:** ga naar <https://login.tailscale.com/admin/dns> en controleer dat **MagicDNS** aan staat.
   Klik daaronder bij **HTTPS Certificates** op **Enable HTTPS**.
4. **Terminal-commando beschikbaar maken (MacBook):** klik in de menubalk op het Tailscale-icoon →
   **Settings** → **Install CLI** (bij oudere versies: open Terminal en gebruik voortaan
   `/Applications/Tailscale.app/Contents/MacOS/Tailscale` in plaats van `tailscale`).
5. **Zorg dat de app draait:** `docker compose up -d --build` en controleer <http://localhost:8080> op je MacBook.
6. **Deel de app in je privénetwerk:** open Terminal op je MacBook en voer uit:

   ```bash
   tailscale serve --bg 8080
   ```

   Tailscale laat het adres zien, iets als `https://macbook-van-mischa.tail1234.ts.net`.
   (Zie je een link om eerst toestemming te geven? Open die, klik op toestaan en voer het commando opnieuw uit.)
   `--bg` betekent dat het blijft werken, ook na een herstart van je Mac.
7. **Telefoon:** open dat `https://…ts.net`-adres in Safari of Chrome.
   Tip: kies **Deel → Zet op beginscherm**, dan staat Overzicht als app-icoon op je telefoon.

**Dagelijks gebruik**

- Je MacBook moet aan staan (niet in slaapstand), Docker Desktop moet draaien en Tailscale moet
  op beide apparaten verbonden zijn.
- Werkt het niet? Controleer eerst of <http://localhost:8080> op je MacBook werkt, en of Tailscale
  op je telefoon aan staat.
- Kijken wat er gedeeld wordt: `tailscale serve status`. Stoppen met delen: `tailscale serve reset`.

**Niet doen:** gebruik geen `tailscale funnel`. Dat zet de app op het openbare internet, en de app heeft
geen inlogscherm terwijl je GitLab-token erachter zit.

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
