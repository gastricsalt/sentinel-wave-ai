# SentinelWave AI — Python Agent

Linux-side capture agent for the SentinelWave AI wireless intrusion detection platform.
Captures 802.11 frames in monitor mode, runs rule-based detection (rogue AP, evil twin,
deauth flood, beacon flood, MAC spoof), and POSTs batched results to your SentinelWave
ingest endpoint over an HMAC-signed channel.

## Requirements

- Linux (Kali, Ubuntu, Debian)
- Python 3.10+
- USB Wi-Fi adapter capable of monitor mode (e.g. Alfa AWUS036ACH, Panda PAU09)
- `aircrack-ng` suite

```bash
sudo apt install -y aircrack-ng python3-pip
pip install -r requirements.txt
```

## Enable monitor mode

```bash
sudo airmon-ng check kill
sudo airmon-ng start wlan0
# new interface is usually wlan0mon
```

## Run

```bash
sudo SENTINEL_HMAC_SECRET=<paste-secret-from-cloud-settings> \
  python3 sentinelwave-agent.py \
  --iface wlan0mon \
  --url https://your-project.lovable.app/api/public/ingest \
  --sensor-id sensor-01
```

## systemd unit

```ini
# /etc/systemd/system/sentinelwave-agent.service
[Unit]
Description=SentinelWave AI Wireless IDS Agent
After=network.target

[Service]
Type=simple
Environment=SENTINEL_HMAC_SECRET=<your-secret>
ExecStart=/usr/bin/python3 /opt/sentinelwave/sentinelwave-agent.py \
  --iface wlan0mon --url https://your-project.lovable.app/api/public/ingest --sensor-id sensor-01
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sentinelwave-agent
journalctl -u sentinelwave-agent -f
```

## Detection rules included

| Rule | Trigger |
| --- | --- |
| Evil Twin | Same SSID observed from 2+ different BSSIDs |
| Beacon flood | >30 unique SSIDs from one source in 5s |
| Deauth flood | >50 deauth frames in 5s window |
| Rogue AP | (Configure SSID/BSSID allowlist — TODO) |
| MAC spoof | Vendor mismatch / impossible RSSI delta (extend in `Detector`) |

## ML hook (optional)

Drop a LightGBM model at `models/classifier.pkl` and extend `Detector` to extract
features (RSSI variance, beacon interval, frame rate, deauth frequency, channel
changes) and call `model.predict_proba()` per frame batch. Push results into
`self._add_threat("anomaly", ...)`.

## Security notes

- The agent never receives or stores user data — only frame metadata.
- All POSTs are signed with HMAC-SHA256; the server rejects requests without
  a valid signature.
- Run on isolated monitoring infrastructure; do not run on production
  laptops/hosts handling sensitive traffic.
