import {
  tacticalActions,
  skillActions,
  expandedSkills,
  abilityCommand,
} from "./abilities";
export type Team = "red" | "blue";
export type Control =
  | "manual"
  | "ai"
  | "direct"
  | "ai-webhook"
  | "webhook"
  | "hybrid";
export const actions = [
  "move_left",
  "move_right",
  "jump",
  "light_attack",
  "heavy_attack",
  "block",
  "dodge",
  "special_attack",
  "ultimate",
  "energy",
  "heal",
  "shield",
  ...tacticalActions,
  ...skillActions,
] as const;
export type Action = (typeof actions)[number];
export const animationKeys = [
  "idle",
  "walk",
  "jump",
  "light_attack",
  "heavy_attack",
  "block",
  "hit",
  "ko",
  "victory",
] as const;
export const optionalAnimationKeys = [
  ...tacticalActions,
  ...skillActions,
] as const;
export interface SkillSpec {
  damage: number;
  range: number;
  start: number;
  active: number;
  recovery: number;
  cooldown: number;
  cost: number;
  energy: number;
}
export interface CombatProfile {
  hurtbox: { width: number; height: number };
  comboWindow: number;
  comboMultiplier: number;
  skills: Partial<Record<Action, SkillSpec>>;
}
export const defaultSkills: Partial<Record<Action, SkillSpec>> = {
  light_attack: {
    damage: 45,
    range: 145,
    start: 3,
    active: 3,
    recovery: 6,
    cooldown: 12,
    cost: 7,
    energy: 0,
  },
  heavy_attack: {
    damage: 90,
    range: 165,
    start: 7,
    active: 4,
    recovery: 12,
    cooldown: 25,
    cost: 18,
    energy: 0,
  },
  special_attack: {
    damage: 145,
    range: 370,
    start: 8,
    active: 5,
    recovery: 15,
    cooldown: 50,
    cost: 25,
    energy: 25,
  },
  ultimate: {
    damage: 280,
    range: 600,
    start: 12,
    active: 8,
    recovery: 25,
    cooldown: 90,
    cost: 30,
    energy: 100,
  },
};
Object.assign(defaultSkills, expandedSkills);

export interface Fighter {
  combat?: CombatProfile;
  appearance?: {
    hairColor: string;
    outfitColor: string;
    facePreset?: "akari" | "ren" | "yuki" | "kuro";
    outfitStyle?: "samurai" | "jacket" | "robe";
    faceAsset?: string;
  };
  id: string;
  version: number;
  name: string;
  title: string;
  element: string;
  color: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  special: string;
  ultimate: string;
  personality: "aggressive" | "balanced" | "counter" | "defensive";
  asset?: string;
  frameWidth?: number;
  frameHeight?: number;
  animations?: Record<string, { start: number; end: number; fps: number }>;
  published: boolean;
  disabled?: boolean;
}
export interface Arena {
  background?: string;
  hazardX?: number;
  hazardRadius?: number;
  hazardDamage?: number;
  id: string;
  name: string;
  subtitle: string;
  theme: "shrine" | "city" | "void";
  color: string;
  hazard: boolean;
  floor: number;
}
export const fighters: Fighter[] = [
  {
    id: "akari",
    version: 1,
    name: "Akari",
    title: "THE CRIMSON BLADE",
    element: "Flame",
    color: "#ff526d",
    hp: 1000,
    attack: 105,
    defense: 90,
    speed: 110,
    special: "Crimson arc",
    ultimate: "Phoenix eruption",
    personality: "aggressive",
    published: true,
  },
  {
    id: "ren",
    version: 1,
    name: "Ren",
    title: "THE STORM RONIN",
    element: "Lightning",
    color: "#60a5fa",
    hp: 1000,
    attack: 100,
    defense: 95,
    speed: 115,
    special: "Thunder step",
    ultimate: "Heaven splitter",
    personality: "counter",
    published: true,
  },
  {
    id: "yuki",
    version: 1,
    name: "Yuki",
    title: "THE FROST ORACLE",
    element: "Frost",
    color: "#79e3de",
    hp: 1050,
    attack: 95,
    defense: 105,
    speed: 95,
    special: "Crystal wave",
    ultimate: "Frozen moon",
    personality: "defensive",
    published: true,
  },
  {
    id: "kuro",
    version: 1,
    name: "Kuro",
    title: "THE VOID REAPER",
    element: "Void",
    color: "#b990ff",
    hp: 950,
    attack: 115,
    defense: 90,
    speed: 105,
    special: "Shadow fang",
    ultimate: "Eclipse",
    personality: "balanced",
    published: true,
  },
];
export const arenas: Arena[] = [
  {
    id: "shrine",
    name: "Sakura Shrine",
    subtitle: "Under a thousand falling petals",
    theme: "shrine",
    color: "#ff91b5",
    hazard: false,
    floor: 420,
  },
  {
    id: "city",
    name: "Neon District",
    subtitle: "Where the night comes alive",
    theme: "city",
    color: "#56d8f7",
    hazard: false,
    floor: 420,
  },
  {
    id: "void",
    name: "Eclipse Gate",
    subtitle: "At the edge of another world",
    theme: "void",
    color: "#a68bfa",
    hazard: false,
    floor: 420,
  },
];
export interface Mapping {
  id: string;
  event: string;
  command: string;
  action: Action;
  team: "any" | Team;
  priority: number;
  amount: number;
}
export interface Settings {
  duration: number;
  bestOf: number;
  mode: "classic" | "elimination" | "endless";
  strategy: "fifo" | "priority" | "voting";
  unknown: "assign" | "ignore";
  allowSwitch: boolean;
  ttl: number;
  queueCap: number;
  userQuota: number;
  votingWindow: number;
  rewardCap: number;
  damageScale: number;
  difficulty: "easy" | "normal" | "hard";
  quality: "low" | "medium" | "high";
  balance: "competitive" | "support" | "dynamic";
  sound: boolean;
  tts: boolean;
  volume: number;
  retentionDays: number;
}
export const defaultSettings: Settings = {
  duration: 99,
  bestOf: 3,
  mode: "classic",
  strategy: "fifo",
  unknown: "assign",
  allowSwitch: false,
  ttl: 3000,
  queueCap: 40,
  userQuota: 5,
  votingWindow: 500,
  rewardCap: 50,
  damageScale: 1,
  difficulty: "normal",
  quality: "high",
  balance: "competitive",
  sound: false,
  tts: false,
  volume: 0.4,
  retentionDays: 30,
};
export const defaultMappings: Mapping[] = [
  {
    id: "attack",
    event: "comment",
    command: "!attack",
    action: "light_attack",
    team: "any",
    priority: 1,
    amount: 1,
  },
  {
    id: "special",
    event: "comment",
    command: "!special",
    action: "special_attack",
    team: "any",
    priority: 2,
    amount: 1,
  },
  {
    id: "guard",
    event: "comment",
    command: "!block",
    action: "block",
    team: "any",
    priority: 1,
    amount: 1,
  },
  {
    id: "jump",
    event: "comment",
    command: "!jump",
    action: "jump",
    team: "any",
    priority: 1,
    amount: 1,
  },
  {
    id: "like",
    event: "like",
    command: "",
    action: "energy",
    team: "any",
    priority: 0,
    amount: 5,
  },
  {
    id: "gift",
    event: "gift",
    command: "Rose",
    action: "special_attack",
    team: "any",
    priority: 3,
    amount: 1,
  },
  {
    id: "follow",
    event: "follow",
    command: "",
    action: "shield",
    team: "any",
    priority: 0,
    amount: 20,
  },
  {
    id: "share",
    event: "share",
    command: "",
    action: "energy",
    team: "any",
    priority: 0,
    amount: 15,
  },
];
// Admin can explicitly import new defaults without replacing saved mappings.
export const expandedMappings: Mapping[] = [
  ...tacticalActions,
  ...skillActions,
].map((action) => ({
  id: "ability-" + action,
  event: "comment",
  command: abilityCommand(action),
  action,
  team: "any",
  priority: skillActions.some((skill) => skill === action) ? 2 : 1,
  amount: 1,
}));
defaultMappings.push(...expandedMappings);
export function mergeMappings(saved: Mapping[]): Mapping[] {
  return [
    ...saved,
    ...expandedMappings.filter(
      (m) =>
        !saved.some(
          (s) =>
            s.id === m.id ||
            (s.event === m.event &&
              s.command === m.command &&
              s.team === "any"),
        ),
    ),
  ];
}
export interface LiveEvent {
  event_id: string;
  source: string;
  user_id: string;
  event_type: string;
  text?: string;
  gift?: string;
  count?: number;
  occurred_at: string;
  team?: Team;
  streak_finished?: boolean;
}
export interface Command {
  id: string;
  user: string;
  team: Team;
  action: Action;
  at: number;
  priority: number;
  amount: number;
  origin: "manual" | "webhook";
}
export interface Actor {
  fighter: Fighter;
  control: Control;
  x: number;
  y: number;
  vy: number;
  hp: number;
  stamina: number;
  energy: number;
  shield: number;
  state: string;
  until: number;
  cooldown: number;
  combo: number;
  damage: number;
  invulnerable: number;
  lastHitTick?: number;
  cooldowns?: Partial<Record<Action, number>>;
  slowUntil?: number;
  pendingEnergy?: number;
  feintUntil?: number;
  airDashUsed?: boolean;
  attack?: {
    action: Action;
    at: number;
    hit: boolean;
    facing?: number;
    start?: number;
  };
}
export interface Log {
  id: string;
  at: number;
  team?: Team;
  event: string;
  action?: string;
  status: string;
  reason: string;
  user?: string;
}
export interface MatchState {
  totalDamage?: Record<Team, number>;
  rewardBudget?: Record<Team, { window: number; spent: number }>;
  lastWebhookAt?: number;
  id: string;
  environment: string;
  status: "idle" | "running" | "paused" | "round-over" | "finished";
  tick: number;
  time: number;
  round: number;
  scores: Record<Team, number>;
  winner: Team | "draw" | null;
  red: Actor;
  blue: Actor;
  arena: Arena;
  settings: Settings;
  queues: Record<Team, Command[]>;
  members: Record<string, Team>;
  contributions: Record<string, number>;
  logs: Log[];
  stats: {
    received: number;
    rejected: number;
    duplicate: number;
    applied: number;
  };
  rosters: Record<Team, Fighter[]>;
  rosterIndex: Record<Team, number>;
}
export function validateFighter(f: Fighter) {
  const errors: string[] = [];
  if (
    !["aggressive", "balanced", "counter", "defensive"].includes(f.personality)
  )
    errors.push("AI personality tidak valid.");
  if (typeof f.published !== "boolean")
    errors.push("Status publish tidak valid.");
  for (const key of ["title", "element", "special", "ultimate"] as const)
    if (typeof f[key] !== "string" || f[key].length > 80)
      errors.push(`${key}: maksimal 80 karakter.`);
  if (typeof f.name !== "string" || !f.name.trim() || f.name.length > 32)
    errors.push("Nama wajib, maksimal 32 karakter.");
  if (!/^#[0-9a-f]{6}$/i.test(f.color))
    errors.push("Warna harus berupa hex enam digit.");
  for (const [k, min, max] of [
    ["hp", 500, 2000],
    ["attack", 50, 150],
    ["defense", 50, 150],
    ["speed", 60, 140],
  ] as const) {
    if (!Number.isFinite(f[k]) || f[k] < min || f[k] > max)
      errors.push(`${k}: ${min}–${max}.`);
  }
  if (f.appearance)
    for (const color of [f.appearance.hairColor, f.appearance.outfitColor])
      if (!/^#[0-9a-f]{6}$/i.test(color))
        errors.push("Warna Character Creator tidak valid.");
  if (
    f.appearance?.facePreset &&
    !["akari", "ren", "yuki", "kuro"].includes(f.appearance.facePreset)
  )
    errors.push("Preset wajah tidak valid.");
  if (
    f.appearance?.outfitStyle &&
    !["samurai", "jacket", "robe"].includes(f.appearance.outfitStyle)
  )
    errors.push("Model pakaian tidak valid.");
  if (
    f.appearance?.faceAsset &&
    !/^\/api\/assets\/[a-f0-9-]+\.(png|webp)$/.test(f.appearance.faceAsset)
  )
    errors.push("Path wajah tidak valid.");
  if (
    f.asset &&
    (f.appearance?.faceAsset ||
      f.appearance?.facePreset ||
      f.appearance?.outfitStyle)
  )
    errors.push(
      "Wajah/pakaian terpisah memerlukan rig modular, bukan spritesheet utuh.",
    );
  if (f.combat) {
    const c = f.combat;
    if (
      !c.hurtbox ||
      !Number.isFinite(c.hurtbox.width) ||
      !Number.isFinite(c.hurtbox.height) ||
      c.hurtbox.width < 30 ||
      c.hurtbox.width > 100 ||
      c.hurtbox.height < 80 ||
      c.hurtbox.height > 180 ||
      !Number.isFinite(c.comboWindow) ||
      c.comboWindow < 15 ||
      c.comboWindow > 90 ||
      !Number.isFinite(c.comboMultiplier) ||
      c.comboMultiplier < 1 ||
      c.comboMultiplier > 1.2
    )
      errors.push("Hurtbox/combo di luar batas aman.");
    for (const [key, skill] of Object.entries(c.skills || {})) {
      if (!defaultSkills[key as Action]) {
        errors.push("Skill tidak dikenal.");
        continue;
      }
      for (const [prop, min, max] of [
        ["damage", 1, key === "ultimate" ? 350 : 180],
        ["range", 60, 650],
        ["start", 1, 30],
        ["active", 1, 15],
        ["recovery", 3, 60],
        ["cooldown", 6, 300],
        ["cost", 1, 60],
        ["energy", 0, 100],
      ] as const)
        if (
          !Number.isFinite(skill[prop]) ||
          skill[prop] < min ||
          skill[prop] > max
        )
          errors.push(`${key}.${prop}: ${min}–${max}.`);
      if (skill.cooldown < skill.start + skill.active + skill.recovery)
        errors.push(
          `${key}: cooldown tidak boleh lebih singkat dari total frame.`,
        );
    }
  }
  if (f.asset) {
    if (
      !f.frameWidth ||
      !f.frameHeight ||
      f.frameWidth < 8 ||
      f.frameHeight < 8 ||
      f.frameWidth > 2048 ||
      f.frameHeight > 2048
    )
      errors.push("Ukuran frame tidak valid.");
    if (
      f.animations?.idle &&
      f.animations?.light_attack &&
      f.animations?.walk &&
      f.animations.idle.start === f.animations.light_attack.start &&
      f.animations.idle.start === f.animations.walk.start
    )
      errors.push("Idle, walk, dan attack memerlukan pose berbeda.");
    for (const key of [
      ...animationKeys,
      ...Object.keys(f.animations || {}).filter(
        (key) => !(animationKeys as readonly string[]).includes(key),
      ),
    ]) {
      if (
        !(animationKeys as readonly string[]).includes(key) &&
        !(optionalAnimationKeys as readonly string[]).includes(key)
      ) {
        errors.push(`Animasi ${key} tidak dikenal.`);
        continue;
      }
      const a = f.animations?.[key];
      if (!f.published && !a) continue;
      if (
        !a ||
        !Number.isInteger(a.start) ||
        !Number.isInteger(a.end) ||
        a.start < 0 ||
        a.end < a.start ||
        !Number.isFinite(a.fps) ||
        a.fps < 1 ||
        a.fps > 60
      )
        errors.push(`Animasi ${key} wajib memiliki frame dan FPS valid.`);
    }
  }
  return errors;
}
