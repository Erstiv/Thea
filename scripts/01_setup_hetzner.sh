#!/bin/bash
# Project Thea — Hetzner Server Setup
# Run as root on Hetzner: ssh filou 'bash -s' < 01_setup_hetzner.sh
#
# What this does:
#   1. Installs Docker + Docker Compose (if not already installed)
#   2. Creates the thea user (UID 1000) for file permissions
#   3. Creates all directory structure
#   4. Sets permissions
#
# After this, you deploy with:
#   scp docker-compose.yml .env root@filou:/opt/thea/
#   ssh filou 'cd /opt/thea && docker compose up -d'

set -euo pipefail

echo "=== Project Thea — Server Setup ==="
echo ""

# ─── 1. Install Docker if not present ───────────────────────
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    echo "Docker installed."
else
    echo "Docker already installed: $(docker --version)"
fi

# ─── 2. Create thea user (UID 1000) if not present ──────────
if ! id -u thea &>/dev/null; then
    echo "Creating thea user (UID 1000)..."
    useradd -u 1000 -m -s /bin/bash thea
    usermod -aG docker thea
    echo "User 'thea' created."
else
    echo "User 'thea' already exists."
fi

# ─── 3. Create directory structure ───────────────────────────
echo "Creating directory structure..."

# App configs
mkdir -p /opt/thea/configs/{prowlarr,sonarr,radarr,lidarr,bazarr,sabnzbd,qbittorrent,overseerr,notifiarr,recyclarr,gluetun}

# Data directories
mkdir -p /data/usenet/{incomplete,complete}
mkdir -p /data/torrents/{incomplete,complete}
mkdir -p /data/media/{movies,tv,music}

# ─── 4. Set permissions ─────────────────────────────────────
echo "Setting permissions..."
chown -R 1000:1000 /opt/thea/configs
chown -R 1000:1000 /data

# ─── 5. Enable TUN device (needed for VPN container) ────────
if [ ! -c /dev/net/tun ]; then
    echo "Creating TUN device..."
    mkdir -p /dev/net
    mknod /dev/net/tun c 10 200
    chmod 600 /dev/net/tun
fi

# ─── 6. Open firewall ports (if ufw is active) ──────────────
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
    echo "Configuring firewall..."
    # Only expose Overseerr and Nginx publicly
    # Other ports stay internal (access via SSH tunnel)
    ufw allow 5055/tcp comment "Overseerr"
    # Ports for SSH tunnel access (already allowed if SSH works):
    # 9696 Prowlarr, 8989 Sonarr, 7878 Radarr, 8686 Lidarr
    # 6767 Bazarr, 8080 SABnzbd, 8085 qBittorrent
    echo "Firewall configured. Internal ports accessible via SSH tunnel."
else
    echo "UFW not active — skipping firewall config."
    echo "⚠️  Consider enabling UFW and only exposing ports 22 and 5055."
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Copy your .env file:  scp .env root@filou:/opt/thea/.env"
echo "  2. Copy docker-compose:  scp docker-compose.yml root@filou:/opt/thea/"
echo "  3. Start everything:     ssh filou 'cd /opt/thea && docker compose up -d'"
echo "  4. Check status:         ssh filou 'cd /opt/thea && docker compose ps'"
echo ""
echo "Access web UIs via SSH tunnel:"
echo "  ssh -L 9696:localhost:9696 -L 8989:localhost:8989 -L 7878:localhost:7878 -L 8080:localhost:8080 -L 8085:localhost:8085 filou"
echo "  Then visit localhost:9696 (Prowlarr), localhost:8989 (Sonarr), etc."
