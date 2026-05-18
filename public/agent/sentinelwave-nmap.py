#!/usr/bin/env python3
"""
SentinelWave AI — Nmap Recon Agent
Polls the SentinelWave job queue, runs authorized nmap scans, and POSTs
results to /api/public/nmap over an HMAC-signed channel.

Usage:
  sudo SENTINEL_HMAC_SECRET=<secret> \\
    python3 sentinelwave-nmap.py \\
    --base-url https://<your-app>.lovable.app \\
    --sensor-id nmap-01 \\
    [--target 192.168.1.0/24 --profile default --interval 0]

If --target is supplied the agent ignores the queue and runs that scan once
(or on a schedule with --interval seconds). Otherwise it polls /api/public/scan-jobs
every --poll seconds and executes whatever the SOC queues.
"""
import argparse, hmac, hashlib, json, os, sys, time, subprocess, shutil
from datetime import datetime, timezone

try:
    import requests
    import nmap  # python-nmap
except ImportError:
    print("Install deps: pip install python-nmap requests", file=sys.stderr); sys.exit(1)

PROFILE_ARGS = {
    "discovery": "-sn -T4",
    "quick":     "-T4 -F",
    "default":   "-T4 -sV --top-ports 1000",
    "intense":   "-T4 -A -p-",
    "vuln":      "-T4 -sV --script vulners",
}

def utcnow():
    return datetime.now(timezone.utc).isoformat()

def sign(secret: str, message: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()

def claim_job(base_url: str, secret: str, sensor_id: str):
    ts = utcnow()
    path = "/api/public/scan-jobs"
    sig = sign(secret, f"GET:{path}:{ts}")
    try:
        r = requests.get(base_url.rstrip("/") + path,
                         headers={"x-sentinel-signature": sig,
                                  "x-sentinel-timestamp": ts,
                                  "x-sentinel-sensor": sensor_id},
                         timeout=10)
        if r.status_code == 200:
            return r.json().get("job")
        print(f"[poll] HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"[poll] error: {e}")
    return None

def run_nmap(target: str, profile: str):
    if shutil.which("nmap") is None:
        raise RuntimeError("nmap binary not found in PATH — install with: sudo apt install -y nmap")
    args = PROFILE_ARGS.get(profile, PROFILE_ARGS["default"])
    print(f"[scan] nmap {args} {target}")
    scanner = nmap.PortScanner()
    started = time.time()
    scanner.scan(hosts=target, arguments=args)
    duration_ms = int((time.time() - started) * 1000)

    hosts = []
    for ip in scanner.all_hosts():
        h = scanner[ip]
        os_guess, os_acc = None, None
        if "osmatch" in h and h["osmatch"]:
            best = h["osmatch"][0]
            os_guess = best.get("name")
            try: os_acc = int(best.get("accuracy"))
            except Exception: pass

        ports = []
        for proto in ("tcp", "udp"):
            if proto in h:
                for port, p in h[proto].items():
                    if p.get("state") != "open":
                        continue
                    ports.append({
                        "port": int(port),
                        "protocol": proto,
                        "state": p.get("state", "open"),
                        "service": p.get("name") or None,
                        "product": p.get("product") or None,
                        "version": p.get("version") or None,
                        "extra_info": p.get("extrainfo") or None,
                        "cpe": p.get("cpe") or None,
                    })

        hosts.append({
            "ip": ip,
            "mac": h["addresses"].get("mac"),
            "hostname": (h.hostname() or None),
            "vendor": next(iter(h.get("vendor", {}).values()), None),
            "os_guess": os_guess,
            "os_accuracy": os_acc,
            "status": h.state(),
            "ports": ports,
        })
    return {
        "started_at": datetime.fromtimestamp(started, tz=timezone.utc).isoformat(),
        "finished_at": utcnow(),
        "duration_ms": duration_ms,
        "hosts": hosts,
    }

def post_scan(base_url: str, secret: str, sensor_id: str, target: str, profile: str, result: dict, job_id=None):
    payload = {"sensor_id": sensor_id, "target": target, "profile": profile, "job_id": job_id, **result}
    body = json.dumps(payload, separators=(",", ":"), default=str)
    sig = sign(secret, body)
    r = requests.post(base_url.rstrip("/") + "/api/public/nmap",
                      data=body,
                      headers={"content-type": "application/json",
                               "x-sentinel-signature": sig},
                      timeout=60)
    print(f"[post] {r.status_code} {r.text[:200]}")
    return r.ok

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True, help="e.g. https://your-app.lovable.app")
    ap.add_argument("--sensor-id", default="nmap-01")
    ap.add_argument("--target", help="One-shot/scheduled CIDR or IP (skips queue)")
    ap.add_argument("--profile", default="default", choices=list(PROFILE_ARGS))
    ap.add_argument("--interval", type=int, default=0, help="Seconds between repeats of --target (0 = once)")
    ap.add_argument("--poll", type=int, default=15, help="Seconds between queue polls when no --target")
    args = ap.parse_args()

    secret = os.environ.get("SENTINEL_HMAC_SECRET")
    if not secret:
        print("Set SENTINEL_HMAC_SECRET env var", file=sys.stderr); sys.exit(1)
    if os.geteuid() != 0:
        print("Run as root for accurate OS / SYN scans (sudo)", file=sys.stderr)

    if args.target:
        while True:
            try:
                result = run_nmap(args.target, args.profile)
                post_scan(args.base_url, secret, args.sensor_id, args.target, args.profile, result)
            except Exception as e:
                print(f"[error] {e}", file=sys.stderr)
            if args.interval <= 0: break
            time.sleep(args.interval)
        return

    print(f"[ready] polling {args.base_url} every {args.poll}s as sensor={args.sensor_id}")
    while True:
        job = claim_job(args.base_url, secret, args.sensor_id)
        if job:
            print(f"[job ] claimed {job['id']} → {job['target']} ({job['profile']})")
            try:
                result = run_nmap(job["target"], job["profile"])
                post_scan(args.base_url, secret, args.sensor_id, job["target"], job["profile"], result, job_id=job["id"])
            except Exception as e:
                print(f"[error] {e}", file=sys.stderr)
        time.sleep(args.poll)

if __name__ == "__main__":
    main()
