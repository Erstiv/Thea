#!/bin/bash
# Deploy Thea Control Panel to Hetzner (Filou)
# Run from your Mac: ./deploy.sh

set -e

SERVER="filou"
REMOTE_DIR="/var/www/thea-panel"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Thea Control Panel Deploy ==="
echo ""

# Step 1: Build React frontend locally
echo "[1/5] Building React frontend..."
cd "$LOCAL_DIR/client"
npm install
npx vite build
echo "  Build complete."

# Step 2: Ensure remote directory exists
echo "[2/5] Preparing server..."
ssh $SERVER "mkdir -p $REMOTE_DIR"

# Step 3: Sync files (exclude node_modules, .git, data)
echo "[3/5] Syncing files to server..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'client/node_modules' \
  --exclude '.git' \
  --exclude 'data' \
  --exclude '.env' \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"
echo "  Files synced."

# Step 4: Install server dependencies on remote
echo "[4/5] Installing dependencies on server..."
ssh $SERVER "cd $REMOTE_DIR && npm install --production"

# Step 5: Restart PM2
echo "[5/5] Restarting service..."
ssh $SERVER "cd $REMOTE_DIR && pm2 startOrRestart ecosystem.config.cjs && pm2 save"

echo ""
echo "=== Deploy complete! ==="
echo "Thea Control Panel is running at https://quietferal.com"
echo ""
echo "Remaining manual steps:"
echo "  1. Copy .env.example to .env on server and fill in secrets:"
echo "     ssh filou 'cp $REMOTE_DIR/.env.example $REMOTE_DIR/.env && nano $REMOTE_DIR/.env'"
echo "  2. Update Nginx config:"
echo "     ssh filou 'cp $REMOTE_DIR/nginx-thea-panel.conf /etc/nginx/sites-available/quietferal.com'"
echo "     ssh filou 'nginx -t && systemctl reload nginx'"
echo "  3. Add DNS for overseerr.quietferal.com (A record → 178.156.251.26)"
echo "  4. Get SSL cert for subdomain:"
echo "     ssh filou 'certbot --nginx -d overseerr.quietferal.com'"
