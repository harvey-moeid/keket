import Phaser from "phaser";
import { drawFighter } from "../src/client/fighter-renderer";
import { fighters, animationKeys, type Actor } from "../src/shared/model";
import { tacticalActions, skillActions } from "../src/shared/abilities";

const all = [...animationKeys, ...tacticalActions, ...skillActions];
const width = 448,
  height = 304,
  columns = 6;
function actor(pose: string, frame: number, frames: number): Actor {
  const state =
    (
      {
        walk: "move",
        block: "guard",
        light_attack: "active",
        heavy_attack: "active",
        victory: "taunt",
      } as Record<string, string>
    )[pose] || pose;
  return {
    fighter: {
      ...fighters[0],
      name: "Hana · example",
      color: "#e69a72",
      appearance: { hairColor: "#66334b", outfitColor: "#34465b" },
    },
    control: "manual",
    x: 0,
    y: 0,
    vy: 0,
    hp: 1000,
    stamina: 100,
    energy: 100,
    shield: 0,
    state: skillActions.includes(pose as any) ? "active" : state,
    until: 0,
    cooldown: 0,
    combo: 0,
    damage: 0,
    invulnerable: 0,
    attack:
      pose.includes("attack") || skillActions.includes(pose as any)
        ? { action: pose as any, at: 0, hit: false, facing: 1 }
        : undefined,
  };
}
class ExampleScene extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics;
  create() {
    this.g = this.add.graphics();
    (window as any).renderExample = (mode: string) => this.renderExample(mode);
    (window as any).assetExampleSpecs = {
      frameWidth: width,
      frameHeight: height,
      columns,
      corePoses: [...animationKeys],
      allPoses: all,
    };
    (window as any).examplesReady = true;
  }
  shape(points: number[], color: number, alpha = 1) {
    const g = this.g;
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2)
      g.lineTo(points[i], points[i + 1]);
    g.closePath();
    g.fillPath();
  }
  label(x: number, y: number, text: string, size = 12, color = "#eadff0") {
    return this.add
      .text(x, y, text, {
        fontFamily: "sans-serif",
        fontSize: size,
        color,
        backgroundColor: "#171c2ddd",
        padding: { x: 6, y: 4 },
      })
      .setDepth(10);
  }
  renderExample(mode: string) {
    this.children.list.filter((c) => c !== this.g).forEach((c) => c.destroy());
    Object.keys(this.textures.list)
      .filter((key) => key.startsWith("asset-example-"))
      .forEach((key) => this.textures.remove(key));
    this.g.clear();
    if (mode.startsWith("fighter")) {
      const expanded = mode.includes("all"),
        guide = mode.includes("guide");
      const poses = expanded ? all : animationKeys;
      const frames = expanded ? 2 : 6;
      const count = poses.length * frames;
      const rows = Math.ceil(count / columns);
      this.scale.resize(width * columns, height * rows);
      for (let index = 0; index < count; index++) {
        const col = index % columns,
          row = Math.floor(index / columns),
          pose = poses[Math.floor(index / frames)],
          phase = index % frames;
        const x = col * width,
          y = row * height;
        if (guide) {
          this.g.fillStyle(index % 2 ? 0x252b3e : 0x1b2234);
          this.g.fillRect(x, y, width, height);
          this.g.lineStyle(1, 0x767385, 0.4);
          this.g.strokeRect(x, y, width, height);
        }
        const a = actor(pose, phase, frames);
        const tile = this.add.graphics().setVisible(false);
        // Fixed canvas anchors: x = half frame width, feet = bottom edge.
        tile.save();
        tile.translateCanvas(width / 2, height);
        tile.scaleCanvas(1.04, 1.04);
        tile.translateCanvas(0, -420);
        if (pose === "ko") tile.translateCanvas(-85, 0);
        if (
          pose === "jump" ||
          pose === "high_jump" ||
          pose === "air_dash" ||
          pose === "meteor_dive"
        )
          a.y = Math.sin((phase / (frames - 1 || 1)) * Math.PI) * 18;
        if (
          pose === "light_attack" ||
          pose === "heavy_attack" ||
          skillActions.includes(pose as any)
        ) {
          tile.rotateCanvas(
            (phase / (frames - 1 || 1) - 0.5) *
              (pose === "heavy_attack" ? 0.14 : 0.08),
          );
          if (phase === 0) {
            a.state = "idle";
            a.attack = undefined;
          }
          if (phase === frames - 1 && frames > 2) {
            a.state = "idle";
            a.attack = undefined;
          }
        }
        drawFighter(tile, a, 1, phase * 73 + 200);
        tile.restore();
        const textureKey = `asset-example-${mode}-${index}`;
        tile.generateTexture(textureKey, width, height);
        tile.destroy();
        this.add.image(x, y, textureKey).setOrigin(0);
        if (guide) {
          this.label(x + 8, y + 8, `${index} · ${pose}`, 16);
          this.g.lineStyle(1, 0x75d8ce, 0.7);
          this.g.lineBetween(x + width / 2, y + 35, x + width / 2, y + height);
          this.g.lineBetween(
            x + 20,
            y + height - 1,
            x + width - 20,
            y + height - 1,
          );
        }
      }
      // Illustrated guide exported at half resolution; upload sheets stay native.
      if (guide) {
        this.cameras.main.setZoom(0.5).setOrigin(0, 0);
        this.scale.resize((width * columns) / 2, (height * rows) / 2);
      } else this.cameras.main.setZoom(1).setOrigin(0, 0);
      return;
    }
    this.cameras.main.setZoom(1).setOrigin(0, 0);
    if (mode === "arena-atlas") {
      this.atlas();
      return;
    }
    this.scale.resize(1000, mode === "arena-background" ? 420 : 500);
    this.arena();
    if (mode !== "arena-background") {
      this.g.fillStyle(0x252e3d);
      this.g.fillRect(0, 420, 1000, 80);
      this.g.lineStyle(2, 0xb0a59f, 0.65);
      this.g.lineBetween(0, 420, 1000, 420);
      for (let i = 0; i < 10; i++) {
        this.g.lineStyle(1, 0x8995a4, 0.2);
        this.g.lineBetween(i * 110, 420, (i - 3) * 180, 500);
      }
      if (mode === "arena-preview") {
        for (const [x, facing] of [
          [330, 1],
          [670, -1],
        ]) {
          const a = actor("idle", 0, 1);
          a.x = x;
          a.y = 0;
          drawFighter(this.g, a, facing, 200);
        }
      } else {
        this.g.fillStyle(0xa8a1ea, 0.16);
        this.g.fillRect(0, 0, 1000, 90);
        this.g.lineStyle(2, 0xc1b4f4);
        this.g.strokeRect(0, 0, 1000, 90);
        this.label(18, 12, "HUD · simpan detail penting di bawah Y=90", 16);
        this.g.fillStyle(0x7ac6bd, 0.1);
        this.g.fillRect(90, 145, 820, 275);
        this.g.lineStyle(2, 0x83d1c6);
        this.g.strokeRect(90, 145, 820, 275);
        this.label(
          110,
          156,
          "Area petarung · X=90…910 · tinggi visual 270 px",
          16,
        );
        this.label(
          16,
          424,
          "Y=420 · lantai engine (bukan bagian background upload)",
          16,
        );
        this.label(16, 467, "Canvas game 1000×500 · background 1000×420", 15);
      }
    }
  }
  arena() {
    const g = this.g;
    // Flattened multi-depth illustration: dusk sky, clouds, peaks, architecture.
    const sky = [0x17223d, 0x273450, 0x39435e, 0x5b526b, 0x8a687b, 0xad8085];
    for (let i = 0; i < 84; i++) {
      g.fillStyle(sky[Math.min(5, Math.floor(i / 14))]);
      g.fillRect(0, i * 5, 1000, 5);
    }
    g.fillStyle(0xffdcba, 0.12);
    g.fillCircle(750, 108, 83);
    g.fillStyle(0xffe5c1, 0.85);
    g.fillCircle(750, 108, 49);
    for (let j = 0; j < 8; j++) {
      g.fillStyle(0xddd6df, 0.07);
      g.fillEllipse(65 + j * 143, 65 + (j % 3) * 35, 190, 20);
    }
    for (let layer = 0; layer < 3; layer++) {
      const pts = [0, 330];
      for (let x = 0; x <= 1000; x += 40)
        pts.push(
          x,
          180 +
            layer * 44 +
            Math.sin(x * 0.01 + layer) * 38 +
            Math.sin(x * 0.023) * 12,
        );
      pts.push(1000, 420, 0, 420);
      this.shape(pts, [0x61647e, 0x454c69, 0x2f3955][layer], 0.9);
    }
    g.fillStyle(0x283b52);
    g.fillRect(0, 335, 1000, 85);
    for (let i = 0; i < 30; i++) {
      g.lineStyle(1, i % 2 ? 0xe4c2b0 : 0x9bb7c4, 0.14);
      const x = (i * 157) % 1000;
      g.lineBetween(
        x,
        348 + (i % 9) * 7,
        x + 25 + (i % 5) * 10,
        348 + (i % 9) * 7,
      );
    }
    for (const x of [90, 850]) {
      g.fillStyle(0x253249);
      g.fillRect(x, 243, 50, 96);
      g.fillStyle(0xd6a18a, 0.7);
      for (let i = 0; i < 3; i++) g.fillRect(x + 10 + i * 12, 263, 5, 16);
      this.shape([x - 18, 243, x + 25, 207, x + 70, 243], 0x273348);
      g.lineStyle(2, 0x87919f, 0.45);
      g.lineBetween(x - 17, 243, x + 69, 243);
    }
    // Pavilion and central gate remain scenery, never collision objects.
    g.fillStyle(0x452f41);
    g.fillRect(460, 277, 10, 125);
    g.fillRect(530, 277, 10, 125);
    g.fillRect(425, 263, 150, 12);
    g.fillRect(444, 292, 112, 6);
    this.shape(
      [415, 262, 445, 256, 500, 247, 555, 256, 585, 262, 577, 268, 425, 268],
      0x302b40,
    );
    g.lineStyle(2, 0xd4a495, 0.6);
    g.lineBetween(435, 270, 565, 270);
    for (const x of [42, 960]) {
      g.lineStyle(12, 0x303348);
      g.lineBetween(x, 395, x + 5, 185);
      g.lineStyle(7, 0x303348);
      g.lineBetween(x, 240, x + (x < 500 ? 72 : -72), 197);
      for (let j = 0; j < 25; j++) {
        g.fillStyle(j % 2 ? 0xa9768f : 0xc591a4, 0.42);
        g.fillEllipse(
          x - 80 + ((j * 37) % 150),
          170 + ((j * 29) % 95),
          50 + (j % 3) * 13,
          30,
        );
      }
    }
    for (const x of [190, 810]) {
      g.fillStyle(0xf1c991, 0.08);
      g.fillCircle(x, 329, 47);
      g.fillStyle(0x484051);
      g.fillRect(x - 5, 328, 10, 89);
      g.fillStyle(0xf3cb93, 0.8);
      g.fillRect(x - 11, 307, 22, 24);
      this.shape([x - 19, 307, x, 291, x + 19, 307], 0x2c3245);
      g.lineStyle(2, 0x867587);
      g.lineBetween(x - 16, 335, x + 16, 335);
    }
    for (let i = 0; i < 25; i++) {
      g.fillStyle(0xd3a1b4, 0.3);
      g.fillEllipse((i * 233) % 1000, 90 + ((i * 67) % 310), 5, 2);
    }
  }
  atlas() {
    const g = this.g;
    this.scale.resize(512, 512);
    // 16 same-size 128px cells, transparent outside each prop.
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * 128,
        y = Math.floor(i / 4) * 128;
      if (i < 4) {
        g.fillStyle([0x394456, 0x475365, 0x596173, 0x303c50][i]);
        g.fillRoundedRect(x + 4, y + 44, 120, 80, 5);
        g.lineStyle(2, 0x9c9aa5, 0.5);
        g.lineBetween(x + 9, y + 48, x + 116, y + 48);
        g.lineStyle(1, 0x263347);
        g.lineBetween(x + 65, y + 50, x + 65, y + 123);
      } else if (i < 8) {
        g.fillStyle(0x454355);
        g.fillRect(x + 60, y + 45, 8, 80);
        g.fillStyle(0xecca92, 0.8);
        g.fillRect(x + 50, y + 26, 28, 28);
        this.shape([x + 40, y + 26, x + 64, y + 8, x + 88, y + 26], 0x343746);
      } else if (i < 12) {
        g.lineStyle(6, 0x414256);
        g.lineBetween(x + 65, y + 115, x + 61, y + 42);
        for (let j = 0; j < 12; j++) {
          g.fillStyle(j % 2 ? 0xbf8aa4 : 0x986a87, 0.7);
          g.fillCircle(x + 25 + ((j * 17) % 78), y + 19 + ((j * 13) % 53), 18);
        }
      } else if (i < 15) {
        this.shape(
          [
            x + 15,
            y + 120,
            x + 34,
            y + 85,
            x + 54,
            y + 71,
            x + 91,
            y + 79,
            x + 117,
            y + 120,
          ],
          0x4c566b,
        );
        this.shape(
          [x + 34, y + 85, x + 54, y + 71, x + 63, y + 98, x + 15, y + 120],
          0x738097,
        );
      } else {
        g.fillStyle(0xeaa770, 0.18);
        g.fillEllipse(x + 64, y + 103, 117, 30);
        g.lineStyle(3, 0xf6bc86, 0.8);
        g.strokeEllipse(x + 64, y + 103, 100, 20);
      }
    }
  }
}
new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "examples",
  width: 1000,
  height: 500,
  transparent: true,
  antialias: true,
  scene: ExampleScene,
  audio: { noAudio: true },
  fps: { target: 30 },
});
