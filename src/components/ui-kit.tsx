import { type ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-destructive/15 text-destructive border-destructive/40",
    high: "bg-warning/15 text-warning border-warning/40",
    warning: "bg-warning/10 text-warning border-warning/30",
    info: "bg-primary/15 text-primary border-primary/40",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${styles[severity] ?? styles.info}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: "danger" | "warn" | "ok" | "default" }) {
  const accentColor = {
    danger: "text-destructive",
    warn: "text-warning",
    ok: "text-success",
    default: "text-foreground",
  }[accent ?? "default"];
  return (
    <div className="glass rounded-xl p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px scan-line opacity-50" />
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{label}</div>
      <div className={`text-3xl font-semibold tabular-nums ${accentColor}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <div className={`glass rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          {title && <h2 className="text-sm font-medium tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
