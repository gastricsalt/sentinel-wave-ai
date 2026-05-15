#!/usr/bin/env python3
"""
SentinelWave AI — Wireless Intrusion Detection Agent
Captures 802.11 frames in monitor mode, runs rule-based detection,
and POSTs batched results to the SentinelWave ingest endpoint.

Usage:
  sudo SENTINEL_HMAC_SECRET=<secret> \\
    python3 sentinelwave-agent.py \\
    --iface wlan0 --url https://your-app/api/public/ingest \\
    --sensor-id sensor-01
"""
import argparse, hmac, hashlib, json, os, sys, time, threading, subprocess
from collections import defaultdict, deque
from datetime import datetime

try:
    from scapy.all import sniff, Dot11, Dot11Beacon, Dot11ProbeResp, Dot11Deauth, Dot11Elt, RadioTap
    import requests
except ImportError:
    print("Install deps: pip install scapy requests", file=sys.stderr); sys.exit(1)

CHANNELS_24 = [1, 6, 11]
CHANNELS_5 = [36, 44, 149, 157]

class Detector:
    def __init__(self):
        self.aps = {}                 # bssid -> dict
        self.clients = {}             # mac -> dict
        self.threats = []
        self.deauth_window = deque()  # (ts, src, dst)
        self.beacon_window = defaultdict(lambda: deque())  # src -> deque[(ts, ssid)]
        self.ssid_to_bssids = defaultdict(set)
        self.lock = threading.Lock()

    def handle_packet(self, pkt):
        if not pkt.haslayer(Dot11): return
        ts = time.time()
        rssi = pkt.dBm_AntSignal if hasattr(pkt, "dBm_AntSignal") else None

        if pkt.haslayer(Dot11Beacon) or pkt.haslayer(Dot11ProbeResp):
            try:
                bssid = pkt[Dot11].addr2.lower()
                ssid_el = pkt[Dot11Elt]
                ssid = ssid_el.info.decode(errors="ignore") if ssid_el and ssid_el.info else ""
                channel = None
                p = pkt[Dot11Elt]
                while isinstance(p, Dot11Elt):
                    if p.ID == 3 and len(p.info) >= 1:
                        channel = p.info[0]; break
                    p = p.payload
            except Exception:
                return
            with self.lock:
                self.aps[bssid] = {
                    "ssid": ssid or None, "bssid": bssid,
                    "channel": int(channel) if channel else None,
                    "encryption": "WPA2",  # simplified; parse RSN IE for accuracy
                    "vendor": None, "signal_strength": int(rssi) if rssi else None,
                    "is_hidden": not bool(ssid),
                }
                if ssid:
                    self.ssid_to_bssids[ssid].add(bssid)
                    if len(self.ssid_to_bssids[ssid]) >= 2:
                        self._add_threat("evil_twin", "critical", 0.9,
                            f"Duplicate SSID '{ssid}' across {len(self.ssid_to_bssids[ssid])} BSSIDs",
                            ssid=ssid, bssid=bssid)
                # beacon flood per src
                w = self.beacon_window[bssid]
                w.append((ts, ssid))
                while w and ts - w[0][0] > 5:
                    w.popleft()
                unique_ssids = len({s for _, s in w})
                if unique_ssids > 30:
                    self._add_threat("beacon_flood", "high", 0.88,
                        f"{unique_ssids} unique SSIDs from {bssid} in 5s",
                        source_mac=bssid, bssid=bssid)

        elif pkt.haslayer(Dot11Deauth):
            try:
                src = pkt[Dot11].addr2.lower(); dst = pkt[Dot11].addr1.lower()
            except Exception:
                return
            with self.lock:
                self.deauth_window.append((ts, src, dst))
                while self.deauth_window and ts - self.deauth_window[0][0] > 5:
                    self.deauth_window.popleft()
                if len(self.deauth_window) > 50:
                    self._add_threat("deauth_flood", "critical", 0.95,
                        f"Deauth burst: {len(self.deauth_window)} frames in 5s",
                        source_mac=src, bssid=dst)
                    self.deauth_window.clear()

        # client frames
        elif pkt.type == 2 and pkt[Dot11].addr2:
            try:
                mac = pkt[Dot11].addr2.lower()
                ap = pkt[Dot11].addr1.lower() if pkt[Dot11].addr1 else None
            except Exception:
                return
            with self.lock:
                c = self.clients.setdefault(mac, {
                    "mac": mac, "vendor": None, "associated_bssid": ap,
                    "packets_seen": 0, "signal_strength": None,
                    "is_random_mac": (int(mac.split(":")[0], 16) & 0x02) != 0,
                })
                c["packets_seen"] += 1
                c["associated_bssid"] = ap or c["associated_bssid"]
                if rssi: c["signal_strength"] = int(rssi)

    def _add_threat(self, type_, severity, conf, desc, **kw):
        self.threats.append({
            "type": type_, "severity": severity, "confidence": conf,
            "description": desc, **kw, "metadata": {"detected_at": datetime.utcnow().isoformat()}
        })

    def drain(self):
        with self.lock:
            payload = {
                "access_points": list(self.aps.values()),
                "clients": list(self.clients.values()),
                "threats": self.threats[:],
            }
            self.threats.clear()
            return payload


def channel_hopper(iface, stop_event):
    chans = CHANNELS_24 + CHANNELS_5
    i = 0
    while not stop_event.is_set():
        ch = chans[i % len(chans)]
        try:
            subprocess.run(["iwconfig", iface, "channel", str(ch)],
                           check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
        i += 1
        time.sleep(0.4)


def post_loop(detector, url, sensor_id, secret, interval, stop_event):
    while not stop_event.is_set():
        time.sleep(interval)
        payload = detector.drain()
        if not (payload["access_points"] or payload["clients"] or payload["threats"]):
            continue
        body = json.dumps({"sensor_id": sensor_id, **payload}, separators=(",", ":"))
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        try:
            r = requests.post(url, data=body, headers={
                "content-type": "application/json",
                "x-sentinel-signature": sig,
            }, timeout=10)
            print(f"[{datetime.utcnow().isoformat()}] POST {r.status_code} aps={len(payload['access_points'])} clients={len(payload['clients'])} threats={len(payload['threats'])}")
        except Exception as e:
            print(f"POST failed: {e}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iface", required=True, help="Monitor-mode interface (e.g. wlan0mon)")
    ap.add_argument("--url", required=True, help="Ingest endpoint URL")
    ap.add_argument("--sensor-id", default="sensor-01")
    ap.add_argument("--interval", type=int, default=10, help="Seconds between POSTs")
    args = ap.parse_args()

    secret = os.environ.get("SENTINEL_HMAC_SECRET")
    if not secret:
        print("Set SENTINEL_HMAC_SECRET env var", file=sys.stderr); sys.exit(1)

    if os.geteuid() != 0:
        print("Must run as root (sudo) for monitor mode + channel hopping", file=sys.stderr); sys.exit(1)

    detector = Detector()
    stop = threading.Event()
    threading.Thread(target=channel_hopper, args=(args.iface, stop), daemon=True).start()
    threading.Thread(target=post_loop, args=(detector, args.url, args.sensor_id, secret, args.interval, stop), daemon=True).start()

    print(f"Sniffing on {args.iface} → {args.url}")
    try:
        sniff(iface=args.iface, prn=detector.handle_packet, store=False)
    except KeyboardInterrupt:
        stop.set(); print("Stopped.")


if __name__ == "__main__":
    main()
