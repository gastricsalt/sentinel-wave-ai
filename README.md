# SentinelWave AI

> Blue-Team / Purple-Team Wireless Defense Platform
> Real-time 802.11 intrusion detection, incident reconstruction, RF triangulation,
> AI forensic analysis, and authorized attack simulation.

SentinelWave AI is a full-stack wireless security platform built with **TanStack
Start (React 19 + Vite 7)** on the frontend and **Lovable Cloud (managed
Supabase)** on the backend. A Python capture agent runs on a Linux box with a
monitor-mode Wi-Fi adapter, streams detections to the cloud over an
HMAC-signed channel, and the web console shows live threats, incidents, attack
chains, triangulated source locations, and AI-generated forensic narratives.

---

## Table of contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Requirements](#requirements)
4. [Linux quick start (web app)](#linux-quick-start-web-app)
5. [Linux quick start (Python sensor agent)](#linux-quick-start-python-sensor-agent)
6. [First-time setup inside the app](#first-time-setup-inside-the-app)
7. [Module map](#module-map)
8. [Environment variables](#environment-variables)
9. [Troubleshooting](#troubleshooting)
10. [Changelog](#changelog)

---

## Features

**Detection & monitoring**
- Live wireless threat feed (evil twin, deauth/beacon flood, rogue AP, WPS,
  Karma, PMKID capture, KRACK, MAC spoof)
- Access point and client inventory with vendor / signal / association history
- HMAC-signed sensor ingest endpoint (`/api/public/ingest`)

**Investigation & forensics**
- **Incidents** — auto-correlated multi-event cases with vertical attack timelines
- **Kill chain** — recon → weaponization → delivery → exploitation → C2 mapping
  with Markov next-stage prediction
- **Threat actors** — behavioral clustering by OUI, beacon timing, channel,
  and attack type
- **Triangulation** — weighted-centroid + log-distance path-loss source
  localization across multiple sensors, rendered on a floor plan
- **AI forensic assistant** — Gemini 2.5 Flash explains incidents in natural
  language

**Reporting**
- Printable executive HTML report (`/security-report`) with 7-day trends,
  risk score, and remediation mapped to NIST / MITRE references
- "Save as PDF" friendly layout

**Purple team lab**
- Scripted multi-stage attack simulations for defensive validation
  (no real RF transmission)
- Admin-gated, persistent "LAB MODE" banner

**AI analyst chat**
- Live context-aware Q&A over current risk score, clients, and recent threats

---

## Architecture

```
+-------------------------+        HMAC-signed JSON          +--------------------------+
| Linux sensor (Python)   |  ───────────────────────────▶    |  /api/public/ingest      |
|  - scapy monitor mode   |                                  |  (TanStack server route) |
|  - rule-based detector  |                                  +-----------+--------------+
+-------------------------+                                              |
                                                                         ▼
                                                            +-----------------------------+
                                                            | Lovable Cloud (Supabase)    |
                                                            |  - Postgres + RLS           |
                                                            |  - Auth                     |
                                                            +-------------+---------------+
                                                                          ▲
                                                                          │ createServerFn
                                                            +-------------+---------------+
                                                            | TanStack Start web console  |
                                                            |  SOC / Incidents / Actors / |
                                                            |  Triangulation / Lab / AI   |
                                                            +-----------------------------+
```

---

## Requirements

### Web app (dev machine — any Linux distro)
- Node.js 20+ **or** [Bun](https://bun.sh) 1.1+
- Git
- A modern browser

### Python sensor agent (Linux only)
- Linux: Kali, Ubuntu 22.04+, Debian 12+, or Parrot
- Python 3.10+
- USB Wi-Fi adapter capable of monitor mode (e.g. Alfa AWUS036ACH, Panda PAU09)
- `aircrack-ng` suite (for `airmon-ng` / `iwconfig`)
- Root privileges (`sudo`)

---

## Linux quick start (web app)

```bash
# 1. Clone
git clone <your-repo-url> sentinelwave
cd sentinelwave

# 2. Install deps (Bun recommended)
curl -fsSL https://bun.sh/install | bash
bun install

# 3. Run dev server
bun run dev
# → http://localhost:5173
```

The `.env` file is auto-provisioned by Lovable Cloud and contains
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
`VITE_SUPABASE_PROJECT_ID`. **Do not edit it manually.**

Production build:

```bash
bun run build
bun run start
```

---

## Linux quick start (Python sensor agent)

The agent lives in `public/agent/` so it's downloadable from the running app
at `/agent/sentinelwave-agent.py`. You can also copy it directly out of the
repo.

### 1. Install system deps

```bash
sudo apt update
sudo apt install -y aircrack-ng python3-pip python3-venv
```

### 2. Set up the agent

```bash
mkdir -p ~/sentinelwave-agent && cd ~/sentinelwave-agent
# either download from the running app:
curl -O https://<your-app>.lovable.app/agent/sentinelwave-agent.py
curl -O https://<your-app>.lovable.app/agent/requirements.txt
# or copy from this repo's public/agent/ directory

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Enable monitor mode

```bash
sudo airmon-ng check kill
sudo airmon-ng start wlan0
# resulting interface is usually wlan0mon
iwconfig
```

### 4. Get your HMAC secret

In the web app → **Settings** → copy the ingest URL.
The shared secret (`INGEST_HMAC_SECRET`) is stored in Lovable Cloud secrets.
Set the same value on the sensor as `SENTINEL_HMAC_SECRET`.

### 5. Run

```bash
sudo SENTINEL_HMAC_SECRET='<your-secret>' \
  ./.venv/bin/python3 sentinelwave-agent.py \
  --iface wlan0mon \
  --url https://<your-app>.lovable.app/api/public/ingest \
  --sensor-id sensor-01
```

You should immediately see access points, clients, and any detected threats
populate the **SOC Console** and **Dashboard**.

### Run as a systemd service

```ini
# /etc/systemd/system/sentinelwave-agent.service
[Unit]
Description=SentinelWave AI Wireless IDS Agent
After=network.target

[Service]
Type=simple
Environment=SENTINEL_HMAC_SECRET=<your-secret>
ExecStart=/home/<user>/sentinelwave-agent/.venv/bin/python3 \
  /home/<user>/sentinelwave-agent/sentinelwave-agent.py \
  --iface wlan0mon \
  --url https://<your-app>.lovable.app/api/public/ingest \
  --sensor-id sensor-01
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sentinelwave-agent
journalctl -u sentinelwave-agent -f
```

---

## First-time setup inside the app

1. Open the app and click **Sign up**. The **first registered user is
   automatically promoted to `admin`** — subsequent users are analysts.
2. Visit **Settings** to copy the ingest URL and confirm your role.
3. (Optional) Go to **Lab** → run a scripted attack to populate demo data
   without real RF transmission.
4. Open **SOC Console** for the live ops view, or **Dashboard** for the
   executive summary.

---

## Module map

| Route | Purpose |
| --- | --- |
| `/dashboard` | Risk score, KPIs, recent threats, simulator controls |
| `/soc` | Full-bleed SOC console — live feed, active incidents, sensor health |
| `/threats` | Threat table with expandable remediation (NIST / MITRE refs) |
| `/incidents` | Auto-correlated multi-event cases |
| `/incidents/$id` | Attack timeline + kill-chain + AI forensic narrative |
| `/actors` | Behavioral threat-actor clusters |
| `/actors/$id` | Per-actor profile and observed techniques |
| `/triangulation` | Multi-sensor RF source localization on a floor plan |
| `/networks` | Access point inventory |
| `/clients` | Client device inventory |
| `/recon` | **Network recon — nmap scan queue, host/port/service exposure, severity-classified findings** |
| `/assessment` | **Vulnerability Assessment — CVE correlation, AI risk scoring, remediation recs, security posture score, network baseline** |
| `/analyst` | AI security analyst chat (Gemini 2.5 Flash) |
| `/reports` | Exports + link to printable security report |
| `/security-report` | Printable executive report (use browser → Save as PDF) |
| `/lab` | Admin-only purple-team attack simulator |
| `/settings` | Role, ingest endpoint, agent downloads |

### Sensor agents (Linux)

| Agent | Purpose |
| --- | --- |
| `sentinelwave-agent.py` | 802.11 monitor-mode wireless IDS (scapy + rule-based detection) |
| `sentinelwave-nmap.py` | **Authorized network recon — runs queued nmap scans and posts findings** |

### Public ingest endpoints

| Path | Method | Used by |
| --- | --- | --- |
| `/api/public/ingest` | POST | Wireless IDS agent — HMAC-signed JSON of APs / clients / threats |
| `/api/public/nmap` | POST | Nmap agent — HMAC-signed scan results (hosts + ports) |
| `/api/public/scan-jobs` | GET | Nmap agent — claims queued scan jobs (HMAC over METHOD:PATH:TIMESTAMP) |

---

## Environment variables

### Web app (auto-managed by Lovable Cloud — `.env`)
| Var | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser + SSR | Public API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + SSR | RLS-bound anon key |
| `VITE_SUPABASE_PROJECT_ID` | Browser + SSR | Project identifier |

### Server-side secrets (set via Lovable Cloud secrets manager)
| Var | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client (server-only, bypasses RLS) |
| `INGEST_HMAC_SECRET` | Verifies signed POSTs from sensor agents |
| `LOVABLE_API_KEY` | Lovable AI Gateway (Gemini) — auto-provisioned |

### Sensor agent (Linux)
| Var | Purpose |
| --- | --- |
| `SENTINEL_HMAC_SECRET` | Must equal the cloud-side `INGEST_HMAC_SECRET` |

---

## Troubleshooting

**"Unauthorized" on `/api/public/ingest`**
The `x-sentinel-signature` header is missing or wrong. Confirm
`SENTINEL_HMAC_SECRET` on the sensor matches `INGEST_HMAC_SECRET` in the cloud.

**Login loop → bounced back to `/login`**
Clear browser storage, sign up a fresh account. If you just provisioned the
backend, give Cloud ~30s to come up (`ACTIVE_HEALTHY`).

**Monitor mode won't enable**
```bash
sudo airmon-ng check kill   # kill NetworkManager / wpa_supplicant first
sudo airmon-ng start wlan0
```
Make sure your adapter actually supports monitor mode — many built-in
laptop chipsets do not.

**No threats appear in the UI**
Run the simulator from **Dashboard** or a scripted attack from **Lab** to
generate synthetic data while you verify your sensor wiring.

**`[unenv] X is not implemented yet!` in server logs**
A server function used a Node-only API not available in the Cloudflare
Worker runtime. Replace with a Web-standard or fetch-based equivalent.

---

## Changelog

Keep this section current. Add a new entry every time the agent ships a
feature, route, table, or breaking change.

- **2026-05-19** — **Network recon module**: new `/recon` route with scan queue,
  host/port inventory, and severity-classified findings (telnet, SMB, RDP,
  exposed DBs, etc.). Added `sentinelwave-nmap.py` Linux agent that polls a
  job queue and runs authorized nmap scans. New tables: `network_scans`,
  `scan_hosts`, `scan_ports`, `scan_jobs`. New endpoints: `/api/public/nmap`,
  `/api/public/scan-jobs`.
- **2026-05-18** — README created with full Linux quick start, module map,
  troubleshooting, env reference. Documented Phase-1 platform (SOC console,
  incidents, actors, triangulation, lab, AI analyst, security report).
- **2026-05-17** — Phase 1 defensive investigation platform: incidents,
  attack-chain timeline, kill-chain prediction, threat-actor clustering,
  RF triangulation, scripted attack lab, AI forensic narratives.
- **2026-05-16** — AI security analyst chat, printable executive report,
  threat knowledge base with NIST / MITRE remediation, expanded threat
  enum (`wps_attack`, `karma`, `pmkid_capture`, `krack`).
- **2026-05-15** — Initial release: auth, dashboard, threats, networks,
  clients, reports, settings, Python capture agent, HMAC-signed ingest.

---

## Running the nmap agent (Linux)

```bash
sudo apt install -y nmap python3-pip
pip install python-nmap requests

# Option A — poll the job queue (recommended; trigger scans from /recon UI)
sudo SENTINEL_HMAC_SECRET='<your-secret>' \
  python3 sentinelwave-nmap.py \
  --base-url https://<your-app>.lovable.app \
  --sensor-id nmap-01

# Option B — one-shot scan, no queue
sudo SENTINEL_HMAC_SECRET='<your-secret>' \
  python3 sentinelwave-nmap.py \
  --base-url https://<your-app>.lovable.app \
  --sensor-id nmap-01 \
  --target 192.168.1.0/24 --profile default

# Option C — scheduled recurring scan
sudo SENTINEL_HMAC_SECRET='<your-secret>' \
  python3 sentinelwave-nmap.py \
  --base-url https://<your-app>.lovable.app \
  --sensor-id nmap-01 \
  --target 10.0.0.0/24 --profile vuln --interval 3600
```

**Profiles:** `discovery` (ping sweep), `quick` (top 100 ports), `default`
(top 1000 + version detection), `intense` (full TCP + OS), `vuln`
(NSE `vulners` script — CVE lookup per service version, requires
`sudo apt install -y nmap-scripts` on some distros).

**Authorization:** only scan networks you own or have written permission
to assess. The agent runs whatever the SOC queues — keep the
`SENTINEL_HMAC_SECRET` private.
