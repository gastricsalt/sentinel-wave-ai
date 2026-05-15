import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Wifi, Activity, Brain, Zap, Lock, Radio, Download } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SentinelWave AI — Real-time Wireless IDS" },
      { name: "description", content: "AI-powered wireless intrusion detection: rogue AP detection, evil twin, deauth attacks, beacon flooding, MAC spoofing — live SOC dashboard." },
      { property: "og:title", content: "SentinelWave AI — Real-time Wireless IDS" },
      { property: "og:description", content: "Real-time wireless intrusion detection with AI threat classification and a modern SOC dashboard." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Wifi, title: "Rogue AP detection", body: "Identifies unauthorised access points by SSID, BSSID, vendor, and signal anomalies." },
  { icon: Radio, title: "Evil Twin & deauth", body: "Detects duplicate-SSID impersonation and burst deauthentication attacks in real time." },
  { icon: Brain, title: "AI classification", body: "LightGBM + Isolation Forest classify suspicious frames with confidence scoring." },
  { icon: Activity, title: "Live SOC console", body: "Charts, alerts, and threat feeds streamed via realtime websockets." },
  { icon: Lock, title: "HMAC-signed ingest", body: "Python agent POSTs detections through a signed endpoint — no exposed credentials." },
  { icon: Zap, title: "One-click demo mode", body: "Built-in simulator for research, education, and academic demonstrations." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="px-6 h-16 flex items-center justify-between border-b border-border/60 backdrop-blur-md bg-background/40 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight text-sm">SentinelWave</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">AI · WIDS</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/login" className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition">Sign in</Link>
          <Link to="/signup" className="px-3 py-1.5 rounded-md text-sm font-medium text-primary-foreground transition" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            Launch console
          </Link>
        </nav>
      </header>

      <section className="relative px-6 py-24 grid-bg overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs text-primary mb-6">
            <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-primary" /> Real-time wireless intrusion detection
          </div>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
            See every <span className="text-gradient">rogue signal</span><br />before your users do.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            SentinelWave AI fuses 802.11 frame analysis, rule-based correlation, and machine learning into a single SOC console. Detect rogue APs, Evil Twins, deauth floods, and MAC spoofing in seconds.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/signup" className="px-5 py-2.5 rounded-md text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              Start monitoring
            </Link>
            <a href="#features" className="px-5 py-2.5 rounded-md text-sm font-medium border border-border hover:border-primary/50 transition">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary mb-2">Capabilities</div>
            <h2 className="text-3xl font-semibold tracking-tight">A complete WIDS pipeline</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="glass rounded-xl p-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: "oklch(0.62 0.22 275 / 15%)", border: "1px solid oklch(0.62 0.22 275 / 30%)" }}>
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-medium tracking-tight mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-border/60">
        <div className="max-w-4xl mx-auto glass-strong rounded-2xl p-10 text-center">
          <Download className="w-8 h-8 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Bring your own sensor</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            A Python + Scapy agent ships ready to run on Kali, Ubuntu or Debian with any monitor-mode capable Wi-Fi adapter. Sign in to download.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium border border-primary/40 hover:bg-primary/10 transition">
            Open console
          </Link>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-border/60 text-center text-xs text-muted-foreground">
        SentinelWave AI · Defensive wireless intrusion detection
      </footer>
    </div>
  );
}
