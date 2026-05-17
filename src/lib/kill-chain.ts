// Maps threat types -> kill chain stages. Pure data, safe in client & server.
export type KillChainStage = "recon" | "weaponization" | "delivery" | "exploitation" | "installation" | "c2" | "actions";

export const STAGE_ORDER: KillChainStage[] = ["recon", "weaponization", "delivery", "exploitation", "installation", "c2", "actions"];

export const STAGE_LABEL: Record<KillChainStage, string> = {
  recon: "Reconnaissance",
  weaponization: "Weaponization",
  delivery: "Delivery",
  exploitation: "Exploitation",
  installation: "Installation",
  c2: "Command & Control",
  actions: "Actions on Objectives",
};

export const THREAT_TO_STAGE: Record<string, KillChainStage> = {
  anomaly: "recon",
  beacon_flood: "recon",
  mac_spoof: "weaponization",
  wps_attack: "delivery",
  pmkid_capture: "delivery",
  karma: "delivery",
  deauth_flood: "exploitation",
  krack: "exploitation",
  evil_twin: "installation",
  rogue_ap: "installation",
};

export function nextLikelyStage(current: KillChainStage): KillChainStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}
