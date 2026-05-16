// Wireless threat knowledge base — used by reports, threats drawer, and AI analyst context.
// Pure data: safe to import on client and server.

export type ThreatType =
  | "rogue_ap"
  | "evil_twin"
  | "deauth_flood"
  | "beacon_flood"
  | "mac_spoof"
  | "anomaly"
  | "wps_attack"
  | "karma"
  | "pmkid_capture"
  | "krack";

export type ThreatKnowledge = {
  label: string;
  category: "infrastructure" | "dos" | "spoofing" | "credential" | "anomaly";
  summary: string;
  risk: string;
  indicators: string[];
  remediation: string[];
  references: { label: string; url: string }[];
  baseRiskScore: number; // 0-100
};

export const THREAT_KB: Record<ThreatType, ThreatKnowledge> = {
  rogue_ap: {
    label: "Rogue Access Point",
    category: "infrastructure",
    summary:
      "An unauthorized AP advertising on managed channels. May be an employee-installed device or a malicious bridge into the corporate LAN.",
    risk: "Bypasses perimeter controls. Can pivot from wireless to wired segments and exfiltrate data.",
    indicators: [
      "Unknown BSSID broadcasting a whitelisted SSID prefix",
      "AP appears on a channel/band not in the managed list",
      "Vendor OUI mismatch vs. approved hardware",
    ],
    remediation: [
      "Identify physical location via RSSI triangulation across sensors",
      "Block BSSID at the WLAN controller and quarantine the switch port",
      "Audit on-call employees and contractor activity in the area",
      "Add the BSSID to the rogue blacklist and enable containment frames if policy allows",
    ],
    references: [
      { label: "NIST SP 800-153 — WLAN Security Guidelines", url: "https://csrc.nist.gov/pubs/sp/800/153/final" },
    ],
    baseRiskScore: 75,
  },
  evil_twin: {
    label: "Evil Twin",
    category: "spoofing",
    summary:
      "A spoofed AP cloning a trusted SSID, typically open or with downgraded encryption, used to harvest credentials or perform MITM.",
    risk: "Captures Wi-Fi handshakes, captive-portal credentials, session cookies, and clear-text traffic.",
    indicators: [
      "Two BSSIDs advertising the same SSID with different security settings",
      "Sudden RSSI spike from a new BSSID near client devices",
      "Channel mismatch vs. the legitimate AP",
    ],
    remediation: [
      "Force EAP-TLS / 802.1X with server-certificate validation on clients",
      "Disable auto-join for open networks via MDM policy",
      "Containment: deauth the rogue BSSID if jurisdiction permits, otherwise escalate",
      "Educate users to verify the lock icon and certificate prompts",
    ],
    references: [
      { label: "MITRE ATT&CK — T1557 Adversary-in-the-Middle", url: "https://attack.mitre.org/techniques/T1557/" },
    ],
    baseRiskScore: 90,
  },
  deauth_flood: {
    label: "Deauthentication Flood",
    category: "dos",
    summary:
      "High-rate 802.11 deauth or disassoc frames forcing clients off an AP. Often a precursor to handshake capture or evil-twin lure.",
    risk: "Denial of service plus credential capture when clients reconnect to a rogue AP.",
    indicators: [
      "> 50 deauth frames/sec from a single source MAC",
      "Multiple target stations within a short window",
      "Reason codes 7 (class-3 frame) or 1 (unspecified)",
    ],
    remediation: [
      "Enable 802.11w (Protected Management Frames) on all SSIDs",
      "Upgrade legacy clients that do not support PMF",
      "Trigger automatic channel switch and alert on-call SOC",
      "Capture pcap of the burst for incident response evidence",
    ],
    references: [
      { label: "IEEE 802.11w PMF", url: "https://standards.ieee.org/ieee/802.11w/3953/" },
    ],
    baseRiskScore: 80,
  },
  beacon_flood: {
    label: "Beacon Flood",
    category: "dos",
    summary:
      "A single source emits hundreds of fake beacons advertising fabricated SSIDs to confuse scanners and clients.",
    risk: "Hides real rogue APs in noise and exhausts client scanner memory on low-end devices.",
    indicators: [
      "Dozens of unique SSIDs from one source MAC in seconds",
      "BSSIDs with sequential or random vendor OUIs",
    ],
    remediation: [
      "Rate-limit beacons at the WLAN controller",
      "Filter scanner UI to ignore SSIDs seen for < 30s with single-source origin",
      "Investigate the source — often a misconfigured pentest tool",
    ],
    references: [
      { label: "Aircrack-ng — mdk4 beacon flood", url: "https://www.aircrack-ng.org/" },
    ],
    baseRiskScore: 50,
  },
  mac_spoof: {
    label: "MAC Spoofing",
    category: "spoofing",
    summary:
      "A station presents a MAC that does not match its OUI vendor, or moves between distant sensors faster than physics allows.",
    risk: "Bypasses MAC ACLs and impersonates trusted devices on captive-portal networks.",
    indicators: [
      "OUI not registered with IEEE or mismatched to advertised vendor",
      "Same MAC seen on two distant sensors within seconds",
      "Locally-administered bit toggling unexpectedly",
    ],
    remediation: [
      "Replace MAC-based ACLs with 802.1X certificate auth",
      "Enable client isolation on guest SSIDs",
      "Cross-reference with DHCP fingerprints and TLS JA3 hashes",
    ],
    references: [
      { label: "IEEE OUI lookup", url: "https://standards-oui.ieee.org/" },
    ],
    baseRiskScore: 60,
  },
  anomaly: {
    label: "ML Anomaly",
    category: "anomaly",
    summary:
      "Behavioral model flagged a beacon-timing, frame-size, or association pattern that deviates from the learned baseline.",
    risk: "Possible novel attack, misconfigured device, or firmware regression.",
    indicators: [
      "Isolation-forest score outside 3σ",
      "Unusual inter-beacon interval",
      "Sudden change in advertised capability bits",
    ],
    remediation: [
      "Review pcap window 60s before/after detection",
      "Correlate with SIEM events from the same time window",
      "Tune model thresholds if false-positive rate exceeds 5%",
    ],
    references: [],
    baseRiskScore: 35,
  },
  wps_attack: {
    label: "WPS PIN Brute-force",
    category: "credential",
    summary:
      "Repeated WPS M1/M3 exchanges suggesting a Pixie-Dust or online PIN attack against the registrar.",
    risk: "Recovers the WPA/WPA2 PSK in hours if WPS is enabled and the AP uses weak nonce generation.",
    indicators: [
      "> 20 WPS exchanges per minute from one source",
      "Repeated EAP failures with identical PIN prefixes",
      "Target AP vendor known vulnerable to Pixie-Dust",
    ],
    remediation: [
      "Disable WPS on every AP; rotate the PSK afterwards",
      "Move to WPA3-SAE which is not affected",
      "Lock out source MAC at the controller for 1 hour minimum",
    ],
    references: [
      { label: "US-CERT VU#723755 (WPS)", url: "https://www.kb.cert.org/vuls/id/723755" },
    ],
    baseRiskScore: 85,
  },
  karma: {
    label: "Karma / MANA Probe Response",
    category: "spoofing",
    summary:
      "An attacker responds to every probe request with a matching SSID, tricking clients with cached open networks to associate.",
    risk: "Client connects to attacker AP unprompted; full MITM follows.",
    indicators: [
      "One BSSID responding to many different SSID probes",
      "Open or downgraded encryption on the responding AP",
    ],
    remediation: [
      "Push MDM profile to forget open SSIDs and disable auto-join",
      "Block hotspot 2.0 ANQP responses from unknown APs",
      "User training: never auto-connect to public Wi-Fi without VPN",
    ],
    references: [
      { label: "MANA toolkit (sensepost)", url: "https://github.com/sensepost/mana" },
    ],
    baseRiskScore: 80,
  },
  pmkid_capture: {
    label: "PMKID Capture",
    category: "credential",
    summary:
      "Attacker captured the PMKID from the first EAPOL frame and is performing offline hashcat cracking against the PSK.",
    risk: "If the PSK is weak (< 12 chars, dictionary word) it falls in hours on consumer GPUs.",
    indicators: [
      "Unusual single EAPOL M1 capture attempts without client follow-up",
      "Hashcat-style query patterns against the AP",
    ],
    remediation: [
      "Rotate PSK to 20+ chars, high entropy; or migrate to WPA3-SAE",
      "Enable Management Frame Protection",
      "Move guests to a separate VLAN with no lateral access",
    ],
    references: [
      { label: "hashcat PMKID attack (Steube, 2018)", url: "https://hashcat.net/forum/thread-7717.html" },
    ],
    baseRiskScore: 88,
  },
  krack: {
    label: "KRACK (Key Reinstallation)",
    category: "credential",
    summary:
      "Manipulation of the 4-way handshake forces nonce reuse, allowing decryption or replay of frames.",
    risk: "Decrypts unicast traffic and injects packets on vulnerable, unpatched clients.",
    indicators: [
      "Retransmitted EAPOL message 3 to the same client",
      "Counter reset observed mid-session",
    ],
    remediation: [
      "Patch all clients (CVE-2017-13077 family) — most modern OSes are fixed",
      "Enable 802.11w PMF",
      "Use HTTPS/HSTS to limit damage from any decrypted frames",
    ],
    references: [
      { label: "krackattacks.com", url: "https://www.krackattacks.com/" },
    ],
    baseRiskScore: 78,
  },
};

export const ALL_THREAT_TYPES = Object.keys(THREAT_KB) as ThreatType[];

export function severityWeight(sev: string): number {
  switch (sev) {
    case "critical": return 1.0;
    case "high": return 0.75;
    case "warning": return 0.45;
    case "info": return 0.2;
    default: return 0.3;
  }
}

export function computeRiskScore(
  threats: Array<{ type: string; severity: string; acknowledged: boolean; confidence: number | string }>,
): { score: number; rating: "low" | "moderate" | "elevated" | "high" | "critical" } {
  if (!threats.length) return { score: 0, rating: "low" };
  const active = threats.filter((t) => !t.acknowledged);
  let raw = 0;
  for (const t of active) {
    const kb = THREAT_KB[t.type as ThreatType];
    const base = kb?.baseRiskScore ?? 40;
    raw += base * severityWeight(t.severity) * Number(t.confidence ?? 0.5);
  }
  // squash to 0-100
  const score = Math.min(100, Math.round(raw / 4));
  const rating =
    score >= 80 ? "critical" :
    score >= 60 ? "high" :
    score >= 40 ? "elevated" :
    score >= 20 ? "moderate" : "low";
  return { score, rating };
}
