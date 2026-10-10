import Phaser from "phaser";
import { skillActions } from "../shared/abilities";
import { defaultSkills, type Actor } from "../shared/model";

/** Visual cues only. Range, collisions and debuffs are resolved by the engine. */
export function drawAbilityEffects(
  g: Phaser.GameObjects.Graphics,
  a: Actor,
  b: Actor,
  time: number,
) {
  const color = Phaser.Display.Color.HexStringToColor(a.fighter.color).color;
  const x = a.x,
    y = 420 - a.y,
    d = a.attack?.facing || (a.x < b.x ? 1 : -1);
  if (["focus", "taunt", "feint", "parry", "brace"].includes(a.state)) {
    g.lineStyle(
      a.state === "parry" ? 4 : 2,
      a.state === "focus" ? 0xf2d68e : color,
      0.65,
    );
    g.strokeEllipse(x, y - 120, a.state === "brace" ? 145 : 120, 260);
    if (a.state === "focus") {
      for (let i = 0; i < 7; i++) {
        g.fillStyle(0xf2d68e, 0.55);
        g.fillCircle(
          x + Math.sin(i * 1.8 + time * 0.002) * 50,
          y - ((time * 0.1 + i * 33) % 250),
          2,
        );
      }
    }
  }
  if (["dash_forward", "dash_back", "air_dash"].includes(a.state)) {
    g.lineStyle(3, color, 0.3);
    for (let i = 0; i < 4; i++)
      g.lineBetween(
        x - d * (85 + i * 8),
        y - 180 + i * 35,
        x - d * 25,
        y - 180 + i * 35,
      );
  }
  if ((a.slowUntil || 0) > 0 && a.state !== "ko") {
    // Caller removes expired statuses using the simulation tick.
    g.lineStyle(2, 0x99e2f5, 0.55);
    g.strokeEllipse(x, y - 8, 105, 16);
  }
  const key = a.attack?.action;
  if (!key || !(skillActions as readonly string[]).includes(key)) return;
  const spec = a.fighter.combat?.skills[key] || defaultSkills[key]!;
  if (a.state === "startup") {
    g.lineStyle(2, color, 0.5);
    g.strokeCircle(x + d * 40, y - 140, 13 + Math.sin(time * 0.02) * 5);
    return;
  }
  if (a.state !== "active") return;
  const reach = Math.min(spec.range, Math.abs(b.x - x));
  const end = x + d * Math.max(65, reach);
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    color: number,
    alpha = 0.8,
  ) => {
    g.lineStyle(width, color, alpha);
    g.lineBetween(x1, y1, x2, y2);
  };
  if (key === "flame_wave") {
    for (let i = 0; i < 9; i++) {
      const px = x + d * (35 + (reach * i) / 9);
      g.fillStyle(i % 2 ? 0xffb96b : 0xfb6951, 0.35);
      g.fillEllipse(px, y - 120, 45, 70 - i * 3);
      g.fillTriangle(
        px - 14,
        y - 110,
        px + d * 18,
        y - 174 - Math.sin(time * 0.02 + i) * 8,
        px + 20,
        y - 111,
      );
    }
  } else if (key === "frost_lance") {
    line(x + d * 25, y - 146, end, y - 146, 11, 0x89dce9, 0.35);
    line(x + d * 25, y - 146, end, y - 146, 3, 0xc8f8ff);
    g.fillStyle(0xbbf4ff, 0.85);
    g.fillTriangle(
      end + d * 25,
      y - 146,
      end - d * 13,
      y - 160,
      end - d * 13,
      y - 132,
    );
  } else if (key === "thunder_strike") {
    const points = [
      [end, 80],
      [end - d * 25, 150],
      [end + d * 14, 142],
      [end - d * 10, y - 110],
      [end + d * 10, y - 120],
      [end, y - 10],
    ];
    for (let i = 1; i < points.length; i++) {
      line(
        ...(points[i - 1] as [number, number]),
        ...(points[i] as [number, number]),
        10,
        0x9abfff,
        0.3,
      );
      line(
        ...(points[i - 1] as [number, number]),
        ...(points[i] as [number, number]),
        2,
        0xe8f5ff,
      );
    }
  } else if (key === "shadow_assault") {
    for (let i = 1; i <= 3; i++) {
      g.fillStyle(0xb193ef, 0.12 / i);
      g.fillEllipse(x - d * i * 38, y - 130, 75, 250);
    }
    line(x + d * 25, y - 140, end + d * 35, y - 170, 7, 0xba9ff7);
  } else if (key === "rising_slash") {
    g.lineStyle(6, 0xffe0a4, 0.8);
    g.beginPath();
    g.arc(x + d * 40, y - 100, 105, -1.5, 0.7, d < 0);
    g.strokePath();
    line(x + d * 30, y - 40, end, y - 250, 3, 0xfff5e4);
  } else if (key === "whirlwind") {
    for (let i = 0; i < 3; i++) {
      g.lineStyle(4 - i, color, 0.6 - i * 0.12);
      g.strokeEllipse(x, y - 115 + i * 30, spec.range * 1.6, 70);
    }
  } else if (key === "earth_shatter") {
    for (let i = 1; i <= 7; i++) {
      const px = x + d * ((reach * i) / 7);
      g.fillStyle(i % 2 ? 0xc2a079 : 0x8b6d59, 0.9);
      g.fillTriangle(
        px - 15,
        420,
        px + 2,
        420 - 35 - (i % 3) * 16,
        px + 18,
        420,
      );
      line(px - 20, 420, px + 20, 420, 3, 0xf3cf94);
    }
  } else if (key === "piercing_thrust") {
    line(x + d * 25, y - 141, end + d * 30, y - 141, 10, 0xf5d69f, 0.3);
    line(x + d * 25, y - 141, end + d * 30, y - 141, 2, 0xfff6e8);
    g.fillStyle(0xffffff, 0.85);
    g.fillTriangle(end + d * 45, y - 141, end, y - 153, end, y - 129);
  } else if (key === "meteor_dive") {
    line(x - d * 40, y - 250, end, 420, 18, 0xff8767, 0.3);
    line(x - d * 40, y - 250, end, 420, 4, 0xffdac0);
    g.lineStyle(4, 0xffa578, 0.6);
    g.strokeEllipse(end, 420, 130, 28);
  } else if (key === "crescent_wave") {
    g.lineStyle(9, 0xc5a9ff, 0.6);
    g.beginPath();
    g.arc(end, y - 145, 70, -1.3, 1.3, d < 0);
    g.strokePath();
    line(x + d * 35, y - 145, end, y - 145, 2, 0xf0e3ff, 0.55);
  }
}
