
# SentinelWave AI — Build Plan

A web-based wireless intrusion detection platform. Lovable builds the dashboard + cloud backend + ingest API + demo simulator. A downloadable Python agent runs separately on Kali/Ubuntu and POSTs detections to the backend.

## What ships in v1

### 1. Lovable Cloud (Postgres) — schema

- `profiles` — user profile mirror of auth.users (display_name)
- `user_roles` + `app_role` enum (`admin`, `analyst`) — security-definer `has_role()` function
- `access_points` — ssid, bssid (unique), channel, encryption, vendor, signal_strength, first_seen, last_seen, is_rogue
- `clients` — mac (unique), vendor, associated_bssid, packets_seen, first_seen, last_seen
- `threats` — type (enum: rogue_ap, evil_twin, deauth_flood, beacon_flood, mac_spoof, anomaly), severity (info/warning/high/critical), confidence (0-1), bssid, description, metadata jsonb, detected_at, acknowledged
- `alerts` — message, severity, threat_id, acknowledged, created_at
- `ingest_events` — raw audit trail of agent posts (sensor_id, payload jsonb, created_at)

RLS: authenticated users can read everything; only `admin` can ack/delete; service role used by ingest endpoint bypasses RLS.

### 2. Auth (Email + roles)

- `/login` and `/signup` (email+password)
- First user auto-promoted to `admin` via trigger; subsequent users default to `analyst`
- `_authenticated` layout guard
- Logout in header

### 3. Public ingest API — `/api/public/ingest`

- HMAC SHA-256 signature verification (`x-sentinel-signature` header, `INGEST_HMAC_SECRET`)
- Accepts batched payload: `{ sensor_id, access_points[], clients[], threats[] }`
- Upserts APs/clients, inserts threats + corresponding alerts
- Server-side rule augmentation: detects evil-twin (duplicate SSID + different BSSID) and elevates severity
- Rate limit via simple per-sensor token check

### 4. Demo Simulator

- Server function `runSimulationTick` (admin-only) — generates a realistic burst of fake APs/clients/threats so the dashboard is alive without hardware
- Toggle in header: "Demo Mode ▶/■" — when on, polls the tick every 5s
- One-shot "Inject attack" buttons (rogue AP / deauth flood / evil twin / beacon flood / MAC spoof)

### 5. Dashboard UI — Midnight Indigo

Routes:
- `/` — public landing (hero, feature grid, CTA to login)
- `/_authenticated/dashboard` — main SOC console
- `/_authenticated/networks` — AP inventory table with filters
- `/_authenticated/clients` — client device table
- `/_authenticated/threats` — threat feed with ack/dismiss (admin)
- `/_authenticated/reports` — CSV export of threats / APs / alerts in selectable date range
- `/_authenticated/settings` — sensor token, HMAC secret reveal (admin), agent download link

Dashboard widgets:
- Top stat cards: active threats, critical alerts (24h), tracked APs, tracked clients
- Live alert feed (Realtime subscription on `alerts`)
- Threats-over-time line chart (Recharts)
- Threat-type distribution donut
- Channel utilization bar
- Top suspicious APs list
- Recent client activity strip

Style: deep navy `#0a0a1a` bg, indigo `#4f46e5` primary, glass cards with subtle indigo glow, mono numerals for stats, neon-edge severity pills (critical=red, high=orange, warning=amber, info=indigo). All tokens in `src/styles.css` as oklch — no hardcoded colors in components.

### 6. Realtime

- Supabase Realtime channel on `threats` and `alerts` → invalidate React Query caches → live dashboard updates

### 7. Python agent scaffold (downloadable)

- `public/agent/sentinelwave-agent.py` — single-file Scapy + aircrack-ng script
- Includes: monitor mode setup, channel hopping, beacon/deauth parsing, rule-based rogue/evil-twin/deauth/beacon-flood/MAC-spoof detection, batched HMAC-signed POST to ingest
- `public/agent/README.md` — install (`apt install aircrack-ng`, `pip install scapy requests`), usage (`sudo python3 sentinelwave-agent.py --iface wlan0 --url <ingest> --secret <hmac>`), systemd unit example, Docker note
- `public/agent/requirements.txt`
- Optional LightGBM hook stub (`models/classifier.py`) with feature-extraction example

Linked from `/settings` ("Download agent").

## Out of scope for v1 (callable in follow-ups)

- Live LightGBM training inside the dashboard (agent ships a stub; training pipeline is a separate task)
- Email/Telegram alert delivery (channel structure is in DB; wiring is a follow-up)
- PDF reports (CSV ships v1; PDF later)
- Federated learning, SDR, BLE, WPA3 deep analysis
- GPS heatmap (no GPS source defined)

## Technical details

- TanStack Start file-based routes, React Query, Recharts, Tailwind v4 (oklch tokens), Lovable Cloud (Postgres + Auth + Realtime)
- Server functions: `getDashboardStats`, `listAccessPoints`, `listClients`, `listThreats`, `ackThreat` (admin), `runSimulationTick` (admin), `injectAttack` (admin), `exportCsv`
- Public route: `/api/public/ingest` (HMAC-verified, uses `supabaseAdmin`)
- Secrets: `INGEST_HMAC_SECRET` (added via secrets tool after Cloud is enabled)
- SEO: per-route head() metadata, sitemap.xml + robots.txt

## Build order

1. Enable Cloud → migration for schema, enums, RLS, role trigger
2. Add `INGEST_HMAC_SECRET`
3. Design tokens (Midnight Indigo) in `src/styles.css`
4. Auth pages + `_authenticated` guard + role hook
5. Server functions + ingest route
6. Dashboard + sub-pages with Realtime
7. Simulator + inject-attack controls
8. Python agent files in `public/agent/`
9. Landing page, sitemap, robots
