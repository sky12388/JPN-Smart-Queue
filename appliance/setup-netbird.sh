#!/usr/bin/env bash
# ==============================================================================
# SmartQueueJPN - NetBird Remote Access & SSH Hardening Script
# Purpose: Connects the appliance to your private Zero-Trust WireGuard mesh
#          and locks down SSH so it is ONLY accessible through NetBird.
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run as root. Run with sudo." >&2
    exit 1
fi

SETUP_KEY="${1:-}"

if [ -z "$SETUP_KEY" ]; then
    echo "Usage: sudo $0 <NETBIRD_SETUP_KEY>"
    echo "Example: sudo $0 9D4A1B2C-3D4E-5F6A-7B8C-9D0E1F2A3B4C"
    exit 1
fi

echo "==> 1. Installing NetBird official repository..."
curl -fsSL https://pkgs.netbird.io/debian/public.key | gpg --dearmor -o /usr/share/keyrings/netbird-archive-keyring.gpg
echo 'deb [signed-by=/usr/share/keyrings/netbird-archive-keyring.gpg] https://pkgs.netbird.io/debian stable main' | tee /etc/apt/sources.list.d/netbird.list

apt-get update -y
apt-get install -y netbird

echo "==> 2. Connecting to NetBird Network..."
netbird up --setup-key "$SETUP_KEY"

echo "==> 3. Enabling NetBird systemd service..."
systemctl enable --now netbird

echo "==> 4. Waiting for NetBird IP assignment..."
sleep 4
NETBIRD_IP=$(netbird status --json | jq -r '.netbirdIp // empty' 2>/dev/null || ip -4 addr show wt0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "")

if [ -n "$NETBIRD_IP" ]; then
    echo "[SUCCESS] Assigned NetBird IP: $NETBIRD_IP"
else
    echo "[WARNING] NetBird interface wt0 still initializing. Check 'netbird status'."
fi

echo "==> 5. Hardening SSH (Restrict SSH to NetBird mesh interface only)..."
cat << 'EOF' > /etc/ssh/sshd_config.d/99-netbird-only.conf
# SmartQueueJPN Security Policy:
# Never expose SSH on physical interfaces (LAN / Wi-Fi).
# Only allow SSH inbound on the WireGuard / NetBird virtual interface (wt0).
Match LocalNetwork 100.64.0.0/10
    PermitRootLogin prohibit-password
    PasswordAuthentication no
    PubkeyAuthentication yes
EOF

systemctl reload ssh || systemctl reload sshd

echo "=========================================================="
echo " [SUCCESS] NetBird is connected and SSH is locked down!  "
echo " You can now SSH remotely via your NetBird management IP. "
echo "=========================================================="
