#!/usr/bin/env bash
# ==============================================================================
# SmartQueueJPN - Debian Appliance Setup Script
# Target OS: Debian 12 (Bookworm) Minimal / Headless
# Purpose: Installs Docker, Hardens System, Configures Firewall & Time Sync
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " [SmartQueueJPN] Starting Debian Appliance Installation "
echo "=========================================================="

if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run as root. Run with sudo." >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> 1. Updating package lists..."
apt-get update -y
apt-get upgrade -y

echo "==> 2. Installing essential utilities..."
apt-get install -y \
    curl \
    wget \
    git \
    ufw \
    fail2ban \
    htop \
    iotop \
    jq \
    ca-certificates \
    gnupg \
    lsb-release \
    systemd-timesyncd

echo "==> 3. Configuring Time Synchronization (NTP for accurate timestamps)..."
timedatectl set-timezone Asia/Kuala_Lumpur
systemctl enable --now systemd-timesyncd

echo "==> 4. Installing Docker & Docker Compose..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

echo "==> 5. Setting up auto-restart and system resilience..."
# Enable hardware watchdog if present, and reboot on kernel panic
sysctl -w kernel.panic=10 > /dev/null
echo "kernel.panic = 10" > /etc/sysctl.d/99-panic.conf

echo "==> 6. Configuring UFW Firewall..."
ufw default deny incoming
ufw default allow outgoing
# Allow local port 3000 for LAN devices (Counter tablets / TV in isolated 4G Wi-Fi)
ufw allow 3000/tcp comment "SmartQueue App"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
# SSH rule: will be bound strictly to NetBird in setup-netbird.sh
ufw --force enable

echo "=========================================================="
echo " [SUCCESS] Base system & Docker successfully configured! "
echo " Next step: Run ./setup-netbird.sh <NETBIRD_SETUP_KEY>    "
echo "=========================================================="
