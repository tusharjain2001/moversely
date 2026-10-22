#!/usr/bin/env bash
# One-time setup of a new Ubuntu 24.04 server (EC2) for the booking site.
# Run it as the normal login user (ubuntu), not root:
#   git clone https://github.com/tusharjain2001/moversely.git /tmp/moversely && bash /tmp/moversely/deploy/setup.sh
# Then fill in the two settings files it names and run deploy/update.sh.
set -euo pipefail

REPO=${REPO:-https://github.com/tusharjain2001/moversely.git}
APP=/opt/survey

# 2 GB of swap: building the website while the chat model is loaded can briefly need more than 4 GB.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

sudo apt-get update
sudo apt-get install -y git curl gnupg python3-venv debian-keyring debian-archive-keyring apt-transport-https

# Node.js 22 for the website.
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Caddy: HTTPS with a free certificate, renewed automatically.
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy

# Ollama for "Talk to AI", reachable only from this server and kept loaded between chats.
curl -fsSL https://ollama.com/install.sh | sh
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=127.0.0.1:11434"\nEnvironment="OLLAMA_KEEP_ALIVE=24h"\n' \
  | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl restart ollama

# The code.
sudo mkdir -p "$APP"
sudo chown "$USER": "$APP"
[ -d "$APP/.git" ] || git clone "$REPO" "$APP"
cd "$APP"
python3 -m venv ai/.venv

# The chat model (same as on the laptop).
sleep 3
ollama pull qwen3:1.7b
ollama create survey-chat -f ai/chat-model/Modelfile

# Start the website and the API with the server, and restart them if they stop.
for s in survey-api survey-web; do
  sed "s/^User=.*/User=$USER/" "deploy/$s.service" | sudo tee "/etc/systemd/system/$s.service" >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable survey-api survey-web

[ -f ai/.env ] || cp deploy/server.env.example ai/.env
chmod 600 ai/.env
touch web/.env.local
chmod 600 web/.env.local

echo
echo "Setup done. Next:"
echo "  1. Fill in $APP/ai/.env"
echo "  2. Put NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... in $APP/web/.env.local"
echo "  3. bash $APP/deploy/update.sh"
