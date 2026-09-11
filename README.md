# The Inner Compass

Your phone's GPS is great at telling you where to go. It is also quietly
eroding your own sense of direction. The Inner Compass turns a walk into a
game: you guess which way home is before the map loads, then check your guess
against the truth and watch your sense of direction sharpen over weeks.

This repository is the foundation of that app. It ships the mobile-first shell,
the device sensor and geolocation layer that later features build on, and the
staging deploy setup. The guess-and-reveal game itself arrives in later work.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone <this-repo-url> the-inner-compass
cd the-inner-compass
npm install
npm run dev
```

Vite prints a local URL (usually http://localhost:5173). Open it on your phone
or in a desktop browser. The compass check needs a real device with a
magnetometer to return a live reading. On a desktop it reports that no compass
is available and falls back to distance.

## Run it like production

The production image is a static build served by nginx.

```bash
docker build -t the-inner-compass .
docker run --rm -p 8080:80 the-inner-compass
# open http://localhost:8080
```

## Staging deploy

`docker-compose.staging.yml` is the file the deploy uses. The web container
serves plain HTTP on port 80 and sits behind a shared reverse proxy, so it
exposes the port to the network rather than publishing it to the host. It joins
an external network named `factory-staging-net`.

To bring it up the same way locally, create that network first:

```bash
docker network create factory-staging-net
docker compose -f docker-compose.staging.yml up --build
```

This build was verified to serve the landing page and to fall back to
`index.html` for deep links.

## Configuration

Three environment variables tune analytics and error tracking. All are
optional. The app runs correctly when they are unset, and unset is the default.

| Variable            | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `SENTRY_DSN`        | Error tracking endpoint (Sentry compatible). |
| `UMAMI_URL`         | Umami analytics script URL.              |
| `UMAMI_WEBSITE_ID`  | Umami website id for this app.           |

Copy `.env.example` to `.env` to set them for a deploy. At container start the
entrypoint writes these values into `public/env-config.js`, which the app reads
at runtime. Nothing secret belongs in the repository.

## Where the code lives

- `src/screens/` and `src/shell/` hold the landing screen and the app layout.
- `src/sensors/` is the sensor layer: `heading.ts` classifies compass quality
  per device, and `geolocation.ts` wraps a single location fix with a strict
  timeout. Both are pure of side effects until you call them and never hang.
- `src/config/`, `src/analytics/`, `src/observability/` handle runtime config,
  Umami, and Sentry, each a safe no-op when its config is missing.

`docs/sensor-verification.md` lists the on-device checks a human runs, because a
magnetometer cannot be tested in a headless browser.

## Tests

```bash
npm test
```

This runs the full Vitest suite (unit and component tests in jsdom). It covers
the sensor classification, the geolocation wrapper, the config and analytics
guards, and the landing screen behavior.

## License

MIT. See [LICENSE](./LICENSE).
