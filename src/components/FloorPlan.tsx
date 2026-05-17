type Sensor = { sensor_id: string; label: string; x_meters: number | string; y_meters: number | string; online: boolean };
type Estimate = { x: number; y: number; confidence: number } | null;

const WIDTH = 50; // meters
const HEIGHT = 40;

export function FloorPlan({ sensors, estimate }: { sensors: Sensor[]; estimate: Estimate }) {
  const sx = (m: number) => (m / WIDTH) * 100;
  const sy = (m: number) => (m / HEIGHT) * 100;
  const radius = estimate ? Math.max(8, 30 * (1 - estimate.confidence)) : 0;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-lg border border-border bg-surface/40">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={100} stroke="oklch(0.62 0.22 275 / 8%)" strokeWidth={0.2} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 12.5} x2={100} y2={i * 12.5} stroke="oklch(0.62 0.22 275 / 8%)" strokeWidth={0.2} />
        ))}
        {/* Sensors */}
        {sensors.map((s) => (
          <g key={s.sensor_id}>
            <circle cx={sx(Number(s.x_meters))} cy={sy(Number(s.y_meters))} r={1.5} fill="oklch(0.62 0.22 275)" />
            <circle cx={sx(Number(s.x_meters))} cy={sy(Number(s.y_meters))} r={3} fill="none" stroke="oklch(0.62 0.22 275 / 40%)" strokeWidth={0.3} />
            <text x={sx(Number(s.x_meters)) + 2} y={sy(Number(s.y_meters)) - 1.5} fontSize={2} fill="oklch(0.7 0.04 260)">{s.label}</text>
          </g>
        ))}
        {/* Estimated attacker zone */}
        {estimate && (
          <g>
            <circle cx={sx(estimate.x)} cy={sy(estimate.y)} r={radius / 3}
              fill="oklch(0.62 0.24 25 / 25%)" stroke="oklch(0.62 0.24 25)" strokeWidth={0.3} strokeDasharray="1 1" />
            <circle cx={sx(estimate.x)} cy={sy(estimate.y)} r={0.8} fill="oklch(0.62 0.24 25)" />
            <text x={sx(estimate.x) + 1.5} y={sy(estimate.y) + 0.5} fontSize={2} fill="oklch(0.85 0.1 25)">
              estimated · {Math.round(estimate.confidence * 100)}%
            </text>
          </g>
        )}
      </svg>
      <div className="absolute bottom-1 right-2 text-[9px] text-muted-foreground tabular-nums">{WIDTH}m × {HEIGHT}m</div>
    </div>
  );
}
