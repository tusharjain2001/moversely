#!/usr/bin/env bash
# Puts the latest code from GitHub live. Run on the server after every change:
#   bash /opt/survey/deploy/update.sh
# The website can show errors for a minute or so while it rebuilds, so update outside busy times.
set -euo pipefail
cd /opt/survey

git pull --ff-only
ai/.venv/bin/pip install -q -r ai/requirements-server.txt
(cd web && npm ci --no-audit --no-fund && npm run build)

# HTTPS for the domain in ai/.env; until the domain points here, plain http on the server's IP.
domain=$(grep -E '^SITE_DOMAIN=' ai/.env | cut -d= -f2- | tr -d ' "' || true)
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
${domain:-:80} {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload-or-restart caddy
sudo systemctl restart survey-api survey-web

echo "Live: $(git log -1 --format='%h %s')"
