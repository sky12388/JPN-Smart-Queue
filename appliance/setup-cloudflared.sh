#!/usr/bin/env bash
# ==============================================================================
# SmartQueueJPN - Cloudflare Tunnel Setup Script (Public Citizen Access)
# Purpose: Bridges the local SmartQueue web app (port 3000) to a public domain
#          (e.g., https://giliran.yourdomain.com) with zero inbound ports open.
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run as root. Run with sudo." >&2
    exit 1
fi

TUNNEL_TOKEN="${1:-}"

if [ -z "$TUNNEL_TOKEN" ]; then
    echo "Usage: sudo $0 <CLOUDFLARE_TUNNEL_TOKEN>"
    echo "Get your tunnel token from: https://one.dash.cloudflare.com/ -> Networks -> Tunnels"
    exit 1
fi

echo "==> 1. Downloading and installing cloudflared..."
ARCH=$(dpkg --print-architecture)
curl -L --output /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
dpkg -i /tmp/cloudflared.deb
rm -f /tmp/cloudflared.deb

echo "==> 2. Installing Cloudflare Tunnel service..."
cloudflared service install "$TUNNEL_TOKEN"

echo "==> 3. Starting cloudflared service..."
systemctl enable --now cloudflared

echo "=========================================================="
echo " [SUCCESS] Cloudflare Tunnel is now active!              "
echo " Citizens can access the PWA without any port forwarding. "
echo "=========================================================="
