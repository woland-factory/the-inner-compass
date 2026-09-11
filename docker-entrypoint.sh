#!/bin/sh
set -e

# Inject runtime config into the static bundle at container start. Unset vars
# become empty strings, which the app treats as "unset" and runs normally.
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__ENV__ = { SENTRY_DSN: "${SENTRY_DSN:-}", UMAMI_URL: "${UMAMI_URL:-}", UMAMI_WEBSITE_ID: "${UMAMI_WEBSITE_ID:-}" };
EOF

exec nginx -g 'daemon off;'
