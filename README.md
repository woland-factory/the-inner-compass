# The Inner Compass

Your phone's GPS is great at telling you where to go. It is also quietly
eroding your own sense of direction. The Inner Compass turns a walk into a
game: you guess which way your start is before the truth loads, then measure
how close you were. It scores your sense of direction against the ground, so
the number is one you can trust.

Here is the loop. Mark where you are standing, walk away, then open the app and
guess the way back. On a phone with a compass you point and lock a direction. On
any device you type how far you think you walked. One location fix reveals the
truth: how far off your direction was, which way your start really is, and how
your distance guess compared. Nothing about the answer shows until you commit
your guess, so the number is honest.

The app is a static single-page app. No account, no backend, no saved data. Each
walk lives in memory for the session only.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone <this-repo-url> the-inner-compass
cd the-inner-compass
npm install
npm run dev
```

Vite prints a local URL (usually http://localhost:5173). Open it on your phone
or in a desktop browser. Pointing and locking a direction needs a real device
with a magnetometer. On a desktop the flow runs in distance-only mode, so you
can still walk the full loop and see a reveal.

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

- `src/screens/` holds the landing screen and `GuessFlow.tsx`, the one screen at
  `/guess` that runs the whole loop as a phase machine. `src/shell/` is the app
  layout.
- `src/game/` is the pure logic: `geoMath.ts` (bearing and distance),
  `scoring.ts` (honest, floor-aware buckets and verdicts), and `nudges.ts`.
- `src/sensors/` is the sensor layer: `heading.ts` classifies compass quality
  per device, `liveHeading.ts` streams the live heading for the aim dial, and
  `geolocation.ts` wraps a single location fix with a strict timeout.
- `src/config/`, `src/analytics/`, `src/observability/` handle runtime config,
  Umami, and Sentry, each a safe no-op when its config is missing.

`docs/sensor-verification.md` lists the on-device checks a human runs, because a
magnetometer cannot be tested in a headless browser.

## Tests

```bash
npm test
```

This runs the full Vitest suite (unit and component tests in jsdom). It covers
the geo math and scoring, the sensor classification, the geolocation wrapper,
the config and analytics guards, and the whole guess-and-reveal flow: the commit
gate, both bearing and distance-only paths, every designed loading and error
state, and the guided first run.

## License

MIT. See [LICENSE](./LICENSE).
