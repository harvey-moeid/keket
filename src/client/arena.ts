import Phaser from "phaser";
import { drawAbilityEffects } from "./ability-effects";
import { skillActions } from "../shared/abilities";
import { drawFighter, FIGHTER_HEIGHT } from "./fighter-renderer";
import type { Actor, MatchState, Team } from "../shared/model";
let current: MatchState | undefined, game: Phaser.Game | undefined;
export function updateArena(state: MatchState) {
  current = state;
}
export function destroyArena() {
  game?.destroy(true);
  game = undefined;
}
export function mountArena(parent: HTMLElement) {
  destroyArena();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1000,
    height: 500,
    transparent: true,
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: BattleScene,
    audio: { noAudio: true },
    fps: { target: 60 },
  });
}
class BattleScene extends Phaser.Scene {
  bg!: Phaser.GameObjects.Graphics;
  actors!: Phaser.GameObjects.Graphics;
  particles!: Phaser.GameObjects.Graphics;
  lastTheme = "";
  hitTick = -1;
  backImage?: Phaser.GameObjects.Image;
  custom = new Map<Team, Phaser.GameObjects.Sprite>();
  loading = new Set<string>();
  petals = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 149) % 1000,
    y: (i * 79) % 430,
    s: 2 + (i % 3),
  }));
  create() {
    this.bg = this.add.graphics();
    this.actors = this.add.graphics().setDepth(3);
    this.particles = this.add.graphics().setDepth(4);
  }
  backdrop(theme: string) {
    const g = this.bg;
    g.clear();
    const city = theme === "city",
      voided = theme === "void";
    g.fillStyle(city ? 0x0d1526 : voided ? 0x171127 : 0x251b37);
    g.fillRect(0, 0, 1000, 500);
    for (let i = 0; i < 24; i++) {
      g.fillStyle(city ? 0x142439 : voided ? 0x201637 : 0x33243f, 0.5);
      g.fillRect(0, i * 18, 1000, 18);
    }
    g.fillStyle(voided ? 0x9671cc : 0xffebdb, 0.055);
    g.fillCircle(670, 107, 110);
    g.fillStyle(voided ? 0xbb98fa : 0xfff0df, 0.12);
    g.fillCircle(670, 107, 85);
    g.fillStyle(voided ? 0xc3a0ff : 0xffecd4, 0.75);
    g.fillCircle(670, 107, 48);
    g.fillStyle(city ? 0x112033 : voided ? 0x171127 : 0x2c203b, 0.85);
    if (voided) g.fillCircle(686, 99, 45);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0xcad7ed, 0.1 + (i % 4) * 0.12);
      g.fillCircle((i * 127) % 1000, (i * 47) % 230, 1);
    }
    for (let j = 0; j < 3; j++) {
      g.fillStyle([0x241d35, 0x211d31, 0x191a2b][j], 0.9);
      g.beginPath();
      g.moveTo(0, 350);
      for (let x = 0; x <= 1000; x += 65)
        g.lineTo(x, 210 + j * 42 + Math.sin(x * 0.012 + j) * 42);
      g.lineTo(1000, 420);
      g.lineTo(0, 420);
      g.closePath();
      g.fillPath();
    }
    if (city) {
      for (let i = 0; i < 12; i++) {
        const x = i * 94,
          h = 80 + ((i * 43) % 170);
        g.fillStyle(i % 2 ? 0x121d2d : 0x172437);
        g.fillRect(x, 400 - h, 72, h);
        g.fillStyle(i % 2 ? 0x87449e : 0x427d9f, 0.7);
        for (let w = 0; w < 5; w++)
          for (let r = 0; r < h / 20; r++)
            if ((w + r + i) % 3)
              g.fillRect(x + 10 + w * 11, 410 - h + r * 19, 4, 7);
        g.fillStyle(0x62d7ef, 0.5);
        g.fillRect(x + 10, 395 - h, 48, 2);
      }
      g.fillStyle(0x54bcd2, 0.35);
      g.fillRect(40, 330, 130, 8);
      g.fillStyle(0xf056a5, 0.4);
      g.fillRect(830, 250, 70, 80);
    } else if (voided) {
      g.lineStyle(3, 0x9f70ec, 0.4);
      g.strokeEllipse(500, 272, 170, 300);
      g.lineStyle(14, 0x7252ae, 0.14);
      g.strokeEllipse(500, 272, 200, 330);
      for (const x of [100, 230, 745, 885]) {
        g.fillStyle(0x302445);
        g.fillRect(x, 220, 20, 200);
        g.fillTriangle(x - 20, 220, x + 10, 180, x + 35, 220);
      }
    } else {
      const torii = (x: number, y: number, scale: number) => {
        g.fillStyle(0x723449);
        g.fillRect(x - 100 * scale, y, 200 * scale, 13 * scale);
        g.fillRect(x - 74 * scale, y + 28 * scale, 148 * scale, 8 * scale);
        g.fillRect(x - 66 * scale, y, 13 * scale, 175 * scale);
        g.fillRect(x + 53 * scale, y, 13 * scale, 175 * scale);
        g.fillStyle(0x452b40);
        g.fillRect(x - 114 * scale, y - 7 * scale, 228 * scale, 10 * scale);
        g.fillTriangle(
          x - 114 * scale,
          y - 7 * scale,
          x - 114 * scale,
          y - 19 * scale,
          x - 85 * scale,
          y - 7 * scale,
        );
        g.fillTriangle(
          x + 114 * scale,
          y - 7 * scale,
          x + 114 * scale,
          y - 19 * scale,
          x + 85 * scale,
          y - 7 * scale,
        );
      };
      torii(500, 252, 0.7);
      for (const x of [140, 860]) {
        g.fillStyle(0x292437);
        g.fillRect(x - 13, 100, 22, 310);
        g.lineStyle(14, 0x292437);
        g.lineBetween(x, 180, x - 85, 120);
        g.lineBetween(x, 220, x + 80, 135);
        for (let j = 0; j < 25; j++) {
          g.fillStyle(j % 2 ? 0x9b506d : 0xd07b91, 0.45);
          g.fillCircle(
            x - 100 + ((j * 37) % 190),
            80 + ((j * 27) % 100),
            17 + (j % 4) * 7,
          );
        }
      }
      for (const x of [235, 765]) {
        g.fillStyle(0x493142);
        g.fillRect(x - 7, 350, 14, 65);
        g.fillStyle(0xe6b680, 0.7);
        g.fillRect(x - 12, 324, 24, 27);
        g.fillStyle(0xe6b680, 0.07);
        g.fillCircle(x, 337, 50);
        g.fillStyle(0x2a2233);
        g.fillTriangle(x - 22, 324, x, 311, x + 22, 324);
      }
    }
    g.fillStyle(0x252433);
    g.fillRect(0, 418, 1000, 82);
    g.fillStyle(0x6c5565, 0.5);
    g.fillRect(0, 419, 1000, 3);
    g.lineStyle(1, 0x756878, 0.18);
    for (let i = 0; i < 15; i++) g.lineBetween(i * 85, 420, (i - 5) * 160, 500);
    g.lineBetween(0, 443, 1000, 443);
    g.lineBetween(0, 481, 1000, 481);
  }
  uploaded(a: Actor, team: Team, time: number) {
    const existing = this.custom.get(team);
    if (!a.fighter.asset || !a.fighter.frameWidth || !a.fighter.frameHeight) {
      existing?.setVisible(false);
      return false;
    }
    const f = a.fighter,
      key = `fighter-${f.id}-${f.version}`;
    if (!this.textures.exists(key)) {
      existing?.setVisible(false);
      if (!this.loading.has(key)) {
        this.loading.add(key);
        this.load.spritesheet(key, f.asset!, {
          frameWidth: f.frameWidth!,
          frameHeight: f.frameHeight!,
        });
        this.load.start();
      }
      return false;
    }
    let sprite = existing;
    if (!sprite) {
      sprite = this.add
        .sprite(a.x, 420 - a.y, key)
        .setOrigin(0.5, 1)
        .setDepth(3);
      this.custom.set(team, sprite);
    } else if (sprite.texture.key !== key) sprite.setTexture(key);
    const animKey =
      a.state === "move"
        ? "walk"
        : ["guard", "parry", "brace"].includes(a.state)
          ? "block"
          : a.state === "hit"
            ? "hit"
            : a.state === "ko"
              ? "ko"
              : a.state === "victory"
                ? "victory"
                : a.y > 0
                  ? "jump"
                  : a.attack
                    ? a.attack.action === "light_attack"
                      ? "light_attack"
                      : "heavy_attack"
                    : "idle";
    const anim =
      f.animations?.[a.attack?.action || a.state] || f.animations?.[animKey];
    if (anim)
      sprite.setFrame(
        anim.start +
          (Math.floor((time / 1000) * anim.fps) % (anim.end - anim.start + 1)),
      );
    sprite
      .setVisible(true)
      .setPosition(a.x, 420 - a.y)
      .setScale(
        FIGHTER_HEIGHT / f.frameHeight!,
        (FIGHTER_HEIGHT / f.frameHeight!) * (a.state === "crouch" ? 0.65 : 1),
      )
      .setFlipX(
        current ? a.x > current[team === "red" ? "blue" : "red"].x : false,
      );
    return true;
  }
  drawActor(a: Actor, team: Team, time: number) {
    const g = this.actors;
    const x = a.x,
      y = 420 - a.y;
    const direction =
      a.attack?.facing ||
      (current && a.x < current[team === "red" ? "blue" : "red"].x ? 1 : -1);
    const color = Phaser.Display.Color.HexStringToColor(a.fighter.color).color;
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, 424, 128, 19);
    const uploaded = this.uploaded(a, team, time);
    if (a.shield > 0 || ["guard", "parry", "brace"].includes(a.state)) {
      g.lineStyle(3, color, 0.4);
      g.strokeEllipse(x, y - 135, 136, 280);
      g.fillStyle(color, 0.07);
      g.fillEllipse(x, y - 135, 136, 280);
    }
    if (a.state === "dodge") {
      g.fillStyle(color, 0.12);
      g.fillEllipse(x - direction * 30, y - 125, 92, 240);
    }
    if (!uploaded) drawFighter(g, a, direction, time);
    drawAbilityEffects(
      g,
      {
        ...a,
        slowUntil: (a.slowUntil || 0) > (current?.tick || 0) ? a.slowUntil : 0,
      },
      current![team === "red" ? "blue" : "red"],
      time,
    );
    if (
      a.state === "active" &&
      !(skillActions as readonly string[]).includes(a.attack?.action || "")
    ) {
      const spec = a.attack?.action;
      const range =
        spec === "ultimate" ? 300 : spec === "special_attack" ? 180 : 85;
      g.lineStyle(spec === "ultimate" ? 12 : 6, color, 0.75);
      g.beginPath();
      g.arc(
        x + direction * 20,
        y - 148,
        range,
        -0.9,
        direction === 1 ? 0.65 : 3.9,
        direction !== 1,
      );
      g.strokePath();
      g.lineStyle(2, 0xffffff, 0.8);
      g.lineBetween(
        x + direction * 35,
        y - 148,
        x + direction * (range + 35),
        y - 172,
      );
    }
  }
  update(time: number) {
    if (!current) return;
    const a = current.arena;
    if (a.background) {
      const key = "background-" + a.background.split("/").pop();
      if (this.textures.exists(key)) {
        if (!this.backImage)
          this.backImage = this.add.image(500, 210, key).setDepth(1);
        else if (this.backImage.texture.key !== key)
          this.backImage.setTexture(key);
        this.backImage.setDisplaySize(1000, 420).setVisible(true);
      } else if (!this.loading.has(key)) {
        this.loading.add(key);
        this.load.image(key, a.background);
        this.load.start();
      }
    } else this.backImage?.setVisible(false);
    const fps = document.querySelector("[data-fps]");
    if (fps) fps.textContent = `${Math.round(this.game.loop.actualFps)} FPS`;
    if (this.lastTheme !== current.arena.theme) {
      this.backdrop(current.arena.theme);
      this.lastTheme = current.arena.theme;
    }
    this.actors.clear();
    this.drawActor(current.red, "red", time);
    this.drawActor(current.blue, "blue", time);
    const p = this.particles;
    p.clear();
    if (current.arena.hazard && current.settings.balance !== "competitive") {
      const x = current.arena.hazardX || 500,
        r = current.arena.hazardRadius || 70;
      p.fillStyle(0xf7a76c, 0.12);
      p.fillEllipse(x, 420, r * 2, 25);
      p.lineStyle(2, 0xf7a76c, 0.6);
      p.strokeEllipse(x, 420, r * 2, 25);
    }
    const count =
      current.settings.quality === "low"
        ? 5
        : current.settings.quality === "medium"
          ? 15
          : 30;
    for (const [i, petal] of this.petals.slice(0, count).entries()) {
      const x = (petal.x + time * 0.013 * (1 + (i % 3))) % 1000,
        y = (petal.y + time * 0.02) % 420;
      p.fillStyle(
        Phaser.Display.Color.HexStringToColor(current.arena.color).color,
        0.3,
      );
      p.fillEllipse(x, y, petal.s * 2, petal.s);
    }
  }
}
