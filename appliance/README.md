# Panduan Pemasangan Debian Standalone Appliance (SmartQueueJPN)

Dokumen ini menyediakan panduan langkah-demi-langkah bagi memasang dan melancarkan perkakasan **Standalone Edge Appliance (Debian 12 Headless)** untuk fasa projek rintis (*Pilot PoC*) di **Jabatan Pendaftaran Negara (JPN Putrajaya)**.

Sistem ini direka bentuk berasaskan prinsip **"Pilot Island" (Pulau Operasi Terasing)** — beroperasi secara bebas menggunakan router selular 4G/5G tanpa menyambung kepada MyGovNet, sekali gus mematuhi sepenuhnya Dasar Keselamatan ICT Kerajaan (DKICT).

---

## 1. Keperluan Perkakasan Cawangan
* **1x Mini PC / Intel NUC** (cth: Celeron N100 / Core i3, 8GB RAM, 128GB NVMe SSD).
* **1x Router 4G/5G CPE** dengan SIM data tanpa had (dedicated).
* **3–6x Tablet Android (8" - 10")** untuk pegawai kaunter rintis.
* **1x Skrin TV Lobi (HDMI)** disambungkan terus ke Mini PC atau peranti paparan lobi.

---

## 2. Pemasangan Pantas Sistem Pengoperasian Debian

1. Muat turun fail ISO **Debian 12 (Bookworm) Minimal / Netinst**:
   * Format pemacu USB menggunakan Rufus / BalenaEtcher.
   * Pasang Debian dengan memilih profil: **Standard System Utilities** dan **SSH Server** (tidak perlu Desktop Environment GUI).

2. Pastikan tetapan BIOS Mini PC:
   * **Restore on AC Power Loss:** `Power On` (supaya sistem hidup semula secara automatik sekiranya bekalan elektrik terputus).

---

## 3. Skrip Persediaan Automatik Appliance

Salin folder projek ke Mini PC (atau `git clone`), kemudian jalankan arahan berikut:

### Langkah A: Pasang Pakej Asas & Docker
```bash
cd /home/ma/Documents/SmartQueueJPN/appliance
sudo chmod +x *.sh
sudo ./install-debian-prereq.sh
```
*Skrip ini akan memasang Docker, Docker Compose, fail2ban, NTP masa Malaysia, dan mengkonfigurasi Firewall (UFW).*

### Langkah B: Sambungkan ke NetBird (Akses Jarak Jauh / Remote Support)
Dapatkan **Setup Key** daripada panel NetBird anda (https://app.netbird.io):
```bash
sudo ./setup-netbird.sh <MASUKKAN_NETBIRD_SETUP_KEY>
```
* **Kelebihan Keselamatan:** SSH akan dikunci dan **HANYA** boleh diakses menerusi alamat IP NetBird anda (`100.x.x.x`). Port SSH tidak didedahkan kepada Wi-Fi atau LAN tempatan.

### Langkah C: Sambungkan Domain Awam untuk Pemohon (Cloudflare Tunnel - Pilihan)
Jika mahu rakyat mengakses PWA dari telefon peribadi tanpa mendedahkan IP awam atau membuka port:
```bash
sudo ./setup-cloudflared.sh <CLOUDFLARE_TUNNEL_TOKEN>
```

---

## 4. Melancarkan Aplikasi SmartQueueJPN

Jalankan arahan Docker Compose untuk memulakan sistem:

```bash
cd /home/ma/Documents/SmartQueueJPN
docker compose up -d --build
```

Semak status sistem:
```bash
docker compose ps
docker compose logs -f
```

---

## 5. Pautan Capaian Tempatan (LAN 4G Wi-Fi)

| Antara Muka | Alamat URL Tempatan | Penerangan |
| :--- | :--- | :--- |
| **Tiket Maya Rakyat** | `http://<IP_APPLIANCE>:3000/#citizen` | PWA untuk pemohon ambil nombor & semak status |
| **Terminal Kaunter** | `http://<IP_APPLIANCE>:3000/#counter` | Antara muka tablet pegawai kaunter |
| **Paparan TV Lobi** | `http://<IP_APPLIANCE>:3000/#tv` | Skrin besar lobi dewan menunggu (Audio TTS Melayu) |
| **Dashboard Penyelia** | `http://<IP_APPLIANCE>:3000/#supervisor` | Metrik KPI, masa menunggu, & kawalan demo |

---

## 6. Sokongan Jarak Jauh (Remote Troubleshooting)

Dari komputer riba anda di mana-mana sahaja (asalkan NetBird aktif):
```bash
ssh ma@<IP_NETBIRD_APPLIANCE>
```
Anda boleh memantau log aplikasi, melakukan sandaran pangkalan data SQLite (`smartqueue.db`), dan mengemaskini kod versi baharu tanpa perlu hadir ke Putrajaya.
