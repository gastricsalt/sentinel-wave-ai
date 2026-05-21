import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Shield, Activity, Wifi, Users, AlertTriangle, FileText, Settings, LogOut, Bot, FileBarChart2, Radar, Crosshair, Fingerprint, FlaskConical, ShieldAlert, ScanSearch, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";

const NAV = [
  { to: "/soc", label: "SOC Console", icon: ShieldAlert },
  { to: "/dashboard", label: "Telemetry", icon: Activity },
  { to: "/incidents", label: "Incidents", icon: Radar },
  { to: "/recon", label: "Network Recon", icon: ScanSearch },
  { to: "/assessment", label: "Vuln Assessment", icon: ShieldCheck },
  { to: "/actors", label: "Threat Actors", icon: Fingerprint },
  { to: "/triangulation", label: "Triangulation", icon: Crosshair },
  { to: "/networks", label: "Networks", icon: Wifi },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/threats", label: "Threats", icon: AlertTriangle },
  { to: "/analyst", label: "AI Analyst", icon: Bot },
  { to: "/lab", label: "Purple Lab", icon: FlaskConical },
  { to: "/security-report", label: "Report", icon: FileBarChart2 },
  { to: "/reports", label: "Exports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-border bg-surface/50 backdrop-blur-md flex flex-col">
        <Link to="/" className="px-5 h-16 flex items-center gap-2.5 border-b border-border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">SentinelWave</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AI · WIDS</span>
          </div>
        </Link>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => {
            const active = path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-foreground border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <div className="text-xs text-muted-foreground truncate px-2">{user?.email}</div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
