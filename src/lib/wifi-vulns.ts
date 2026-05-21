// Wireless vulnerability knowledge base. Analyzes 802.11 access points and
// returns a list of findings derived from SSID, BSSID/OUI, encryption mode,
// channel, hidden state, vendor, and rogue/evil-twin flags.

export type WifiSeverity = "info" | "low" | "medium" | "high" | "critical";

export type WifiFinding = {
  id: string;            // stable per (bssid + finding code)
  bssid: string;
  ssid: string | null;
  code: string;          // short code, e.g. WIFI-OPEN
  title: string;
  summary: string;
  severity: WifiSeverity;
  cvss: number;          // 0-10 advisory score
  cve?: string;          // related CVE if applicable
  reference?: string;
  recommendation: string;
};

type ApInput = {
  id: string;
  bssid: string;
  ssid: string | null;
  encryption: string | null;
  channel: number | null;
  is_hidden: boolean;
  is_rogue: boolean;
  vendor: string | null;
  signal_strength: number | null;
};

const DEFAULT_SSIDS = [
  /^linksys$/i, /^netgear/i, /^dlink/i, /^tplink/i, /^belkin/i,
  /^xfinitywifi$/i, /^attwifi$/i, /^default$/i, /^wireless$/i,
  /^home$/i, /^home\s?network$/i, /^router$/i, /^huawei[-_]?/i,
  /^tenda/i, /^myqwest/i, /^2wire/i,
];

const HONEYPOT_SSIDS = [
  /^free[\s_-]?wi[\s_-]?fi$/i, /^public[\s_-]?wi[\s_-]?fi$/i,
  /^airport[\s_-]?free/i, /^starbucks$/i, /^hotel[\s_-]?guest$/i,
];

function normEnc(e: string | null): string {
  return (e ?? "").toLowerCase();
}

export function analyzeAccessPoint(ap: ApInput): WifiFinding[] {
  const out: WifiFinding[] = [];
  const enc = normEnc(ap.encryption);
  const ssid = ap.ssid ?? "";

  const push = (f: Omit<WifiFinding, "id" | "bssid" | "ssid">) =>
    out.push({ id: `${ap.bssid}:${f.code}`, bssid: ap.bssid, ssid: ap.ssid, ...f });

  // ---- Encryption posture ----
  if (!enc || enc === "open" || enc === "none") {
    push({
      code: "WIFI-OPEN",
      title: "Open network — no encryption",
      summary: "Traffic is transmitted in cleartext. Any nearby device can sniff credentials, cookies, and session data.",
      severity: "critical",
      cvss: 9.1,
      recommendation: "Enable WPA3-SAE (or WPA2-AES at minimum) with a strong passphrase. Disable open SSID broadcasts.",
    });
  } else if (enc.includes("wep")) {
    push({
      code: "WIFI-WEP",
      title: "WEP encryption — broken since 2001",
      summary: "WEP keys can be recovered in minutes using statistical attacks (aircrack-ng, FMS, PTW). Treat as effectively unencrypted.",
      severity: "critical",
      cvss: 9.0,
      reference: "https://nvd.nist.gov/vuln/detail/CVE-2007-0070",
      recommendation: "Replace with WPA3-SAE. Decommission any hardware that cannot support WPA2-AES or newer.",
    });
  } else if (enc.includes("wpa") && !enc.includes("wpa2") && !enc.includes("wpa3")) {
    push({
      code: "WIFI-WPA1",
      title: "WPA (v1) with TKIP — deprecated",
      summary: "WPA1/TKIP is vulnerable to Beck-Tews / Ohigashi-Morii packet injection and chopchop-style attacks.",
      severity: "high",
      cvss: 7.5,
      recommendation: "Upgrade to WPA2-AES (CCMP) or, preferably, WPA3-SAE.",
    });
  } else if (enc.includes("tkip")) {
    push({
      code: "WIFI-TKIP",
      title: "TKIP cipher in use",
      summary: "TKIP is deprecated and slow; mixed WPA/WPA2-TKIP networks downgrade fast clients and expose them to known cipher attacks.",
      severity: "medium",
      cvss: 5.9,
      recommendation: "Force AES-CCMP only. Remove TKIP from the cipher suite list on the AP.",
    });
  } else if (enc.includes("wpa2") && !enc.includes("wpa3")) {
    // KRACK affects WPA2 4-way handshake — patched at client/AP, but worth flagging.
    push({
      code: "WIFI-KRACK",
      title: "WPA2 without WPA3 — KRACK / FragAttacks exposure",
      summary: "WPA2 4-way handshake is susceptible to KRACK (CVE-2017-13077..82) and FragAttacks (CVE-2020-24586..88) on unpatched clients/APs. Roll forward to WPA3 where supported.",
      severity: "medium",
      cvss: 5.4,
      cve: "CVE-2017-13077",
      reference: "https://www.krackattacks.com/",
      recommendation: "Enable WPA3-SAE transition mode and verify all APs and client drivers have KRACK/FragAttacks patches.",
    });
  }

  // ---- WPS (assume on if encryption string mentions it) ----
  if (enc.includes("wps")) {
    push({
      code: "WIFI-WPS-PIN",
      title: "WPS PIN enabled — Pixie Dust risk",
      summary: "WPS external registrar PIN is brute-forceable in hours (Reaver) or seconds offline (Pixie Dust, CVE-2014-9636 class) on many chipsets.",
      severity: "high",
      cvss: 8.1,
      reference: "https://en.wikipedia.org/wiki/Wi-Fi_Protected_Setup#Vulnerabilities",
      recommendation: "Disable WPS on every AP. Provision new clients via WPA3-SAE or QR provisioning.",
    });
  }

  // ---- Hidden SSID ----
  if (ap.is_hidden) {
    push({
      code: "WIFI-HIDDEN",
      title: "Hidden SSID provides no real security",
      summary: "Clients actively probe for hidden networks, leaking the SSID and exposing users to Karma / evil-twin attacks even when away from the office.",
      severity: "low",
      cvss: 3.1,
      recommendation: "Broadcast the SSID and rely on strong WPA3-SAE authentication instead.",
    });
  }

  // ---- Default / honeypot SSIDs ----
  if (ssid && DEFAULT_SSIDS.some((r) => r.test(ssid))) {
    push({
      code: "WIFI-DEFAULT-SSID",
      title: "Default vendor SSID in use",
      summary: `SSID "${ssid}" matches a known default. Defaults are indexed by wardriving databases and often paired with default admin credentials.`,
      severity: "medium",
      cvss: 5.0,
      recommendation: "Rename the SSID and confirm AP admin credentials have been changed from defaults.",
    });
  }
  if (ssid && HONEYPOT_SSIDS.some((r) => r.test(ssid))) {
    push({
      code: "WIFI-HONEYPOT-NAME",
      title: "SSID matches a common honeypot/captive name",
      summary: `"${ssid}" is a name frequently used by attackers to lure clients (evil twin / KARMA).`,
      severity: "medium",
      cvss: 5.3,
      recommendation: "Confirm this AP is owned by your organization. If not, treat as rogue and locate via triangulation.",
    });
  }

  // ---- Rogue / evil twin flagged upstream ----
  if (ap.is_rogue) {
    push({
      code: "WIFI-ROGUE-AP",
      title: "Rogue access point flagged",
      summary: "This BSSID was classified as rogue (unauthorized OR impersonating a corporate SSID). Active man-in-the-middle risk.",
      severity: "critical",
      cvss: 9.4,
      recommendation: "Locate via RSSI triangulation, physically remove, and open an incident. Quarantine any clients that associated.",
    });
  }

  // ---- 2.4 GHz overlapping channels ----
  if (ap.channel && [1, 6, 11].indexOf(ap.channel) === -1 && ap.channel <= 14) {
    push({
      code: "WIFI-BAD-CHANNEL",
      title: `Non-standard 2.4 GHz channel ${ap.channel}`,
      summary: "Overlapping 2.4 GHz channels cause noise and make legitimate deauth/jam attacks easier to disguise as RF interference.",
      severity: "info",
      cvss: 1.0,
      recommendation: "Use channels 1, 6, or 11 only on 2.4 GHz, or move clients to 5/6 GHz.",
    });
  }

  // ---- Suspicious / unknown vendor on a corporate-looking SSID ----
  if (ap.vendor && /unknown|locally administered|private/i.test(ap.vendor)) {
    push({
      code: "WIFI-RANDOM-OUI",
      title: "Locally-administered MAC on infrastructure AP",
      summary: "APs normally use globally-unique OUIs. A locally-administered BSSID often indicates a software AP (hostapd, mana-toolkit) used for evil-twin or KARMA attacks.",
      severity: "high",
      cvss: 7.4,
      recommendation: "Verify physical ownership of this BSSID. If unknown, treat as a rogue AP.",
    });
  }

  return out;
}

export function scoreWifiPosture(findings: WifiFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 15;
    else if (f.severity === "high") score -= 8;
    else if (f.severity === "medium") score -= 4;
    else if (f.severity === "low") score -= 1;
  }
  return Math.max(0, score);
}
