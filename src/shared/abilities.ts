import type { Action, SkillSpec } from "./model";

export const tacticalActions = [
  "dash_forward",
  "dash_back",
  "crouch",
  "high_jump",
  "air_dash",
  "parry",
  "focus",
  "taunt",
  "brace",
  "feint",
] as const;
export const skillActions = [
  "flame_wave",
  "frost_lance",
  "thunder_strike",
  "shadow_assault",
  "rising_slash",
  "whirlwind",
  "earth_shatter",
  "piercing_thrust",
  "meteor_dive",
  "crescent_wave",
] as const;
export const tacticalSpecs: Record<
  (typeof tacticalActions)[number],
  { cost: number; duration: number; cooldown: number }
> = {
  dash_forward: { cost: 14, duration: 5, cooldown: 20 },
  dash_back: { cost: 14, duration: 5, cooldown: 20 },
  crouch: { cost: 3, duration: 14, cooldown: 20 },
  high_jump: { cost: 18, duration: 4, cooldown: 35 },
  air_dash: { cost: 18, duration: 6, cooldown: 35 },
  parry: { cost: 25, duration: 6, cooldown: 45 },
  focus: { cost: 10, duration: 24, cooldown: 75 },
  taunt: { cost: 5, duration: 30, cooldown: 90 },
  brace: { cost: 15, duration: 18, cooldown: 50 },
  feint: { cost: 8, duration: 4, cooldown: 40 },
};
const spec = (
  damage: number,
  range: number,
  start: number,
  active: number,
  recovery: number,
  cooldown: number,
  cost: number,
  energy: number,
): SkillSpec => ({
  damage,
  range,
  start,
  active,
  recovery,
  cooldown,
  cost,
  energy,
});
export const expandedSkills: Partial<Record<Action, SkillSpec>> = {
  flame_wave: spec(110, 420, 10, 5, 18, 60, 20, 20),
  frost_lance: spec(85, 460, 8, 4, 16, 65, 18, 25),
  thunder_strike: spec(100, 320, 9, 3, 18, 70, 20, 30),
  shadow_assault: spec(90, 160, 6, 4, 17, 60, 22, 25),
  rising_slash: spec(95, 155, 5, 4, 17, 50, 18, 15),
  whirlwind: spec(110, 220, 8, 8, 20, 75, 25, 30),
  earth_shatter: spec(125, 260, 12, 5, 24, 85, 28, 35),
  piercing_thrust: spec(105, 210, 6, 3, 17, 60, 20, 20),
  meteor_dive: spec(160, 230, 8, 6, 24, 90, 30, 35),
  crescent_wave: spec(100, 520, 11, 5, 20, 80, 23, 30),
};
export interface SkillMechanic {
  knockback?: number;
  launch?: number;
  guardPierce?: number;
  slow?: number;
  stun?: number;
  drain?: number;
  dash?: number;
  airborne?: boolean;
  grounded?: boolean;
  omnidirectional?: boolean;
  high?: boolean;
}
export const skillMechanics: Partial<Record<Action, SkillMechanic>> = {
  flame_wave: { knockback: 35 },
  frost_lance: { slow: 45 },
  thunder_strike: { stun: 14 },
  shadow_assault: { dash: 140 },
  rising_slash: { launch: 10 },
  whirlwind: { omnidirectional: true, guardPierce: 0.5, knockback: 30 },
  earth_shatter: { grounded: true, guardPierce: 0.75, knockback: 55, stun: 10 },
  piercing_thrust: { guardPierce: 1 },
  meteor_dive: { airborne: true, dash: 80, knockback: 50 },
  crescent_wave: { high: true, drain: 15 },
};
export const abilityLabels: Record<string, string> = {
  dash_forward: "Dash maju",
  dash_back: "Dash mundur",
  crouch: "Merunduk",
  high_jump: "Lompat tinggi",
  air_dash: "Air dash",
  parry: "Parry",
  focus: "Focus",
  taunt: "Taunt",
  brace: "Brace",
  feint: "Feint",
  flame_wave: "Flame Wave",
  frost_lance: "Frost Lance",
  thunder_strike: "Thunder Strike",
  shadow_assault: "Shadow Assault",
  rising_slash: "Rising Slash",
  whirlwind: "Whirlwind",
  earth_shatter: "Earth Shatter",
  piercing_thrust: "Piercing Thrust",
  meteor_dive: "Meteor Dive",
  crescent_wave: "Crescent Wave",
};
export const abilityDescriptions: Record<string, string> = {
  dash_forward: "Maju cepat 85 unit tanpa menembus lawan di tanah.",
  dash_back: "Mundur cepat 85 unit.",
  crouch: "Hurtbox lebih rendah; menghindari Crescent Wave saat merunduk.",
  high_jump: "Lompatan lebih tinggi; memerlukan posisi di tanah.",
  air_dash: "Dash maju di udara; sekali per lompatan.",
  parry: "Window 6 tick: menangkis satu hit dan membuat penyerang stun.",
  focus: "Channel 24 tick untuk 12 energi; batal jika terkena hit.",
  taunt: "Pose terbuka 30 tick untuk 8 energi; batal jika terkena hit.",
  brace:
    "Tahan 18 tick; menerima 45% damage tanpa hitstun, kecuali Piercing Thrust.",
  feint: "Startup serangan berikutnya 35% lebih cepat selama 60 tick.",
  flame_wave: "Gelombang jarak menengah dengan knockback 35 unit.",
  frost_lance: "Lance es memperlambat gerakan 45 tick jika tidak diblok.",
  thunder_strike: "Petir memberi hitstun 14 tick jika tidak diblok.",
  shadow_assault: "Dash 140 unit sebelum serangan jarak dekat.",
  rising_slash: "Tebasan meluncurkan lawan ke udara jika tidak diblok.",
  whirlwind: "Serangan melingkar dua arah; block menerima 50% damage.",
  earth_shatter: "Hanya di tanah; block menerima 75% damage, knockback kuat.",
  piercing_thrust:
    "Tusukan menembus block/brace; shield tetap menyerap damage.",
  meteor_dive: "Hanya di udara; dash dan menyelam dengan damage besar.",
  crescent_wave:
    "Gelombang tinggi; drain 15 energi pada hit tanpa block, bisa dihindari dengan crouch.",
};
export const abilityCommand = (action: string) =>
  "!" + action.replaceAll("_", "");
