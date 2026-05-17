## Goal
Expand SentinelWave AI from "alerting tool" → **Blue/Purple Team Wireless Defense Platform** with attack reconstruction, forensics, kill-chain, threat actor profiling, AI prediction, and a SOC-style console.

You listed 20 modules (51–70). Building all 20 in one pass would be shallow. I'll deliver **the 8 highest-impact ones** as a deeply integrated, working system — the rest become natural follow-ups on the same data model.

## What I'll build now (Phase 1)

### 1. Forensic data model (foundation for everything else)
Migration adds:
- `incidents` — groups related threats into a single investigation (auto-correlation by time window + BSSID/MAC).
- `attack_chain_events` — ordered timeline rows linked to incidents (recon → flood → deauth → rogue AP → reassociation).
- `threat_actors` — clustered attacker profiles (fingerprint hash, first/last seen, attack count, preferred channels, MO).
- `sensors` — registered monitoring nodes with location coords + last RSSI report.
- `rssi_observations` — per-sensor signal samples for triangulation.
- `kill_chain_stage` enum: `recon, weaponization, delivery, exploitation, installation, c2, actions`.

### 2. **Module 51 — Attack Path Reconstruction** (`/incidents/$id`)
Server fn correlates threats within a sliding window into an incident, then renders an interactive vertical timeline + node-link graph (BSSID ↔ client ↔ rogue AP). Each event shows packets, RSSI, stage.

### 3. **Module 54 — Wireless Kill Chain** (component on incident page + dashboard widget)
Maps each chain event to a kill-chain stage, shows current phase, predicts next stage from historical chain patterns (simple Markov over `attack_chain_events`).

### 4. **Module 55 — Threat Actor Profiling** (`/actors`, `/actors/$id`)
Clusters threats by source_mac/BSSID OUI + beacon timing + channel + attack-type signature into actor profiles. Shows attack history, targeted SSIDs, behavioral fingerprint, similarity score.

### 5. **Module 52 — Source Triangulation** (`/triangulation`)
Sensors POST RSSI samples (already-supported `/api/public/ingest` extended). Weighted-centroid + log-distance path-loss estimate produces (x,y) on a floor map. SVG floor plan with sensor pins, estimated attacker zone, and confidence ellipse. Seeded with 3 demo sensors + simulated RSSI so it works without real hardware.

### 6. **Module 61 — AI Attack Prediction** (dashboard banner + analyst prompt)
Background heuristic + Gemini call: looks at last 60 min of probes/beacon/channel anomalies, returns predicted attack + ETA + confidence. Surfaces as a "Predicted Threat" card.

### 7. **Module 62 — Incident Response Playbooks** (on each incident)
Per threat-type playbook from `threat-knowledge.ts`, expanded with: containment steps, evidence-preservation commands, affected-device list (auto-computed from chain), one-click "Acknowledge + Mark Contained".

### 8. **Module 65 — SOC Console** (`/soc`)
Full-bleed dark ops view: live threat feed (realtime via Supabase channel), active-incident strip, sensor health, AI confidence gauge, world/floor map, key metrics. Auto-refreshes; designed for wall display.

### 9. **Module 68 — AI Forensic Assistant** (extends existing `/analyst`)
New "Explain this incident" action on each incident → produces natural-language forensic narrative + exports to the existing **PDF/HTML security report** (extended to include incident packet, chain diagram, actor profile, triangulation snapshot).

### 10. **Purple Team Safety Rails (Modules 57/58)**
Existing simulator already injects attacks. I'll add:
- Persistent "LAB MODE" banner when simulator used in last 24h.
- Admin-only gate already present; add explicit confirmation dialog with legal acknowledgment.
- New PCAP-replay-style simulator: enqueues a *scripted multi-stage attack chain* (beacon flood → deauth → rogue AP → reassociation) so reconstruction + kill-chain demos are reproducible.

## Technical details

```text
src/lib/
  incidents.functions.ts     correlate, get, list, explain
  actors.functions.ts        cluster, profile, similarity
  triangulation.functions.ts ingest samples, estimate position
  prediction.functions.ts    AI + heuristic next-attack
  forensic-pdf.functions.ts  extend security-report data

src/routes/_authenticated/
  soc.tsx                    SOC console
  incidents.tsx              list
  incidents.$id.tsx          reconstruction + kill chain + playbook
  actors.tsx, actors.$id.tsx
  triangulation.tsx
  lab.tsx                    scripted attack-chain simulator

src/components/
  KillChainBar.tsx
  AttackTimeline.tsx
  FloorPlan.tsx
  IncidentGraph.tsx          (react-flow or hand-rolled SVG)
```

Realtime: enable `supabase_realtime` on `threats`, `incidents`, `alerts`.
Correlation runs server-side on each new threat insert (Postgres trigger calling an Edge-equivalent server fn via cron-style polling, or inline from the simulator/ingest paths).

## Out of scope this pass (Phase 2 — call out, don't build)
Modules 53 (full PCAP storage), 56 (RF movement animation), 59 (YARA/firmware), 60 (hunting query language), 63 (separate scoring service — partially covered by existing risk score), 64 (digital twin), 66 (multi-layer fusion — partially covered), 67 (device trust), 69 (federated sharing), 70 (multi-tenant sensor fleet). These plug into the same `incidents` / `sensors` / `actors` tables when you want them.

## Estimated impact
~6 new tables, ~8 new server fns, ~7 new routes, ~5 new components, 1 migration, extends 2 existing files (`security-report`, `analyst`). No new external paid services — uses existing Lovable AI Gateway (Gemini 2.5 Flash).

Approve and I'll execute end-to-end.
