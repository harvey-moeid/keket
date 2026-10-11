import Phaser from "phaser";
import type { Actor } from "../shared/model";

// World-space visual height. Keep feet on the floor for both imported art and
// the procedural rig; the authoritative combat geometry is defined by profiles.
export const FIGHTER_HEIGHT = 270;
const palettes: Record<
  string,
  { hair: number; skin: number; shadow: number; cloth: number }
> = {
  akari: { hair: 0x642c40, skin: 0xf2c5ac, shadow: 0xbc7f75, cloth: 0x382635 },
  ren: { hair: 0x243c57, skin: 0xe8bea1, shadow: 0xa8786b, cloth: 0x25344a },
  yuki: { hair: 0x315c65, skin: 0xf4d6c4, shadow: 0xc5958b, cloth: 0x263e43 },
  kuro: { hair: 0x3d334f, skin: 0xdab49f, shadow: 0x9b726d, cloth: 0x302b43 },
};
const mix = (color: number, target: number, amount: number) => {
  const a = Phaser.Display.Color.IntegerToColor(color);
  const b = Phaser.Display.Color.IntegerToColor(target);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    a,
    b,
    100,
    amount * 100,
  );
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

/** An articulated, shaded anime rig with a readable three-quarter face. */
export function rigPose(a: Actor, time: number) {
  const active = ["startup", "active", "recovery"].includes(a.state);
  return {
    y: 420 - a.y + (a.state === "idle" ? Math.sin(time * 0.0035) * 1.3 : 0),
    offsetX: a.state === "ko" ? -55 : 0,
    offsetY: a.state === "ko" ? -32 : 0,
    scaleY: a.state === "crouch" ? 0.65 : a.state === "dodge" ? 0.75 : 1,
    rotation:
      a.state === "ko"
        ? Math.PI / 2
        : ["dash_forward", "dash_back", "air_dash", "feint"].includes(a.state)
          ? 0.17
          : a.state === "dodge"
            ? -0.16
            : active
              ? 0.045
              : a.state === "hit"
                ? -0.08
                : 0,
  };
}
export function drawFighter(
  g: Phaser.GameObjects.Graphics,
  a: Actor,
  direction: number,
  time: number,
  customFaceLoaded = false,
) {
  const basePalette = palettes[a.fighter.id] || palettes.akari;
  const faceId = a.fighter.appearance?.facePreset || a.fighter.id;
  const facePalette = palettes[faceId] || basePalette;
  const p = {
    ...basePalette,
    skin: facePalette.skin,
    shadow: facePalette.shadow,
  };
  const accent = Phaser.Display.Color.HexStringToColor(a.fighter.color).color;
  const hair = a.fighter.appearance
    ? Phaser.Display.Color.HexStringToColor(a.fighter.appearance.hairColor)
        .color
    : p.hair;
  const cloth = a.fighter.appearance
    ? Phaser.Display.Color.HexStringToColor(a.fighter.appearance.outfitColor)
        .color
    : p.cloth;
  const lightCloth = mix(cloth, 0xffffff, 0.15);
  const darkCloth = mix(cloth, 0x070b15, 0.45);
  const hairLight = mix(hair, accent, 0.35);
  const active = ["startup", "active", "recovery"].includes(a.state);
  const guard = ["guard", "parry", "brace"].includes(a.state);
  const moving = a.state === "move";
  const air = a.y > 0;
  const walk = moving ? Math.sin(time * 0.018) : 0;
  const breathe = Math.sin(time * 0.0035);
  const poly = (points: number[], color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2)
      g.lineTo(points[i], points[i + 1]);
    g.closePath();
    g.fillPath();
  };
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    color: number,
    alpha = 1,
  ) => {
    g.lineStyle(width, color, alpha);
    g.lineBetween(x1, y1, x2, y2);
  };
  const oval = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha = 1,
  ) => {
    g.fillStyle(color, alpha);
    g.fillEllipse(x, y, w, h);
  };
  const limb = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    color: number,
  ) => {
    line(x1, y1, x2, y2, width, color);
    oval(x1, y1, width, width, color);
    oval(x2, y2, width, width, color);
    line(x1 - 2, y1, x2 - 2, y2, 2.5, mix(color, 0xffffff, 0.18), 0.8);
  };

  g.save();
  const pose = rigPose(a, time);
  g.translateCanvas(a.x, pose.y);
  g.scaleCanvas(direction * 1.08, 1.08 * pose.scaleY);
  g.translateCanvas(pose.offsetX, pose.offsetY);
  g.rotateCanvas(pose.rotation);

  // Rear hair and scarf layer gives each fighter a different silhouette.
  if (a.fighter.id === "yuki") {
    poly([-21, -231, -29, -184, -43, -133, -15, -145, 5, -195], hair);
    line(-24, -217, -30 + breathe * 2, -150, 2, hairLight, 0.65);
  }
  const flutter = Math.sin(time * 0.005) * 5 + (moving ? 13 : 0);
  poly(
    [-10, -177, -38, -172, -67 - flutter, -139, -46 - flutter, -147, -26, -160],
    mix(accent, 0x171725, 0.28),
  );
  poly([-18, -176, -42, -169, -74 - flutter, -163, -56, -177], accent);
  line(-35, -169, -60 - flutter, -164, 1.3, mix(accent, 0xffffff, 0.35));

  // Anatomical two-segment legs: thigh, knee, shin and grounded boots.
  const backKneeX = -22 + walk * 12;
  const backFootX = -31 + walk * 22 - (air ? 9 : 0);
  const frontKneeX = 15 - walk * 11 + (air ? 9 : 0);
  const frontFootX = 28 - walk * 22;
  limb(-12, -95, backKneeX, -56 + Math.abs(walk) * 4, 23, darkCloth);
  limb(backKneeX, -56, backFootX, -18 - (air ? 19 : 0), 17, darkCloth);
  limb(12, -94, frontKneeX, -54 - (air ? 13 : 0), 25, cloth);
  limb(
    frontKneeX,
    -54 - (air ? 13 : 0),
    frontFootX,
    -17 - (air ? 5 : 0),
    18,
    cloth,
  );
  for (const [kx, ky] of [
    [backKneeX, -56],
    [frontKneeX, -54 - (air ? 13 : 0)],
  ]) {
    oval(kx, ky, 17, 20, 0x57606c);
    poly(
      [
        kx - 7,
        ky - 7,
        kx + 6,
        ky - 8,
        kx + 7,
        ky + 5,
        kx,
        ky + 9,
        kx - 7,
        ky + 4,
      ],
      0x303849,
    );
    line(kx - 5, ky - 5, kx + 5, ky - 6, 1.5, 0x87949b);
  }
  for (const [fx, fy] of [
    [backFootX, air ? -19 : 0],
    [frontFootX, air ? -5 : 0],
  ]) {
    g.fillStyle(0x161d2b);
    g.fillRoundedRect(fx - 10, fy - 28, 21, 25, 4);
    poly(
      [
        fx - 10,
        fy - 12,
        fx + 9,
        fy - 12,
        fx + 19,
        fy - 4,
        fx + 19,
        fy,
        fx - 12,
        fy,
      ],
      0x1c2432,
    );
    line(fx - 10, fy - 1, fx + 19, fy - 1, 3, 0x0a1019);
    line(fx - 8, fy - 23, fx + 8, fy - 23, 3, mix(accent, 0x222433, 0.35));
    line(fx + 3, fy - 10, fx + 12, fy - 6, 1.5, 0x687181);
  }

  // Rear arm, then tailored torso with lapels, seams, shaded armor and sash.
  const rearElbowX = guard ? -18 : -37;
  const rearHandX = guard ? 6 : -26;
  const rearHandY = guard ? -178 : -114;
  limb(-24, -162, rearElbowX, -132, 18, darkCloth);
  limb(rearElbowX, -132, rearHandX, rearHandY, 14, darkCloth);
  oval(rearHandX, rearHandY, 13, 17, p.shadow);
  poly(
    [
      -26, -166, -10, -176, 12, -173, 29, -161, 23, -132, 21, -93, -20, -93,
      -24, -132,
    ],
    cloth,
  );
  poly([-25, -162, -11, -170, -8, -139, -17, -100, -23, -103], lightCloth);
  poly([17, -170, 29, -162, 22, -133, 21, -94, 8, -94, 12, -145], darkCloth);
  poly([-11, -176, -5, -147, 2, -153, 10, -174], 0x131b28);
  poly(
    [-14, -174, -4, -166, -1, -151, -9, -146, -19, -165],
    mix(accent, 0xffffff, 0.1),
  );
  poly(
    [10, -175, 20, -163, 9, -145, 1, -151, 5, -166],
    mix(accent, 0x171725, 0.18),
  );
  line(-18, -135, -12, -107, 1.2, lightCloth);
  line(12, -133, 15, -111, 1.4, 0x0d1421);
  line(-7, -126, 8, -130, 1.4, lightCloth, 0.8);
  line(-8, -118, 4, -120, 1.3, darkCloth);
  // Individual coat tails open with the stride rather than one flat triangle.
  poly([-22, -107, -4, -101, -10 - walk * 5, -74, -32 - walk * 5, -81], cloth);
  poly([5, -105, 22, -106, 34 - walk * 4, -83, 16 - walk * 4, -72], darkCloth);
  line(-29 - walk * 5, -81, -11 - walk * 5, -75, 2, accent);
  line(18 - walk * 4, -74, 32 - walk * 4, -83, 2, accent);
  g.fillStyle(0x18212b);
  g.fillRoundedRect(-24, -108, 49, 12, 3);
  line(-23, -102, 24, -102, 2.5, mix(accent, 0x151820, 0.2));
  g.fillStyle(0xcab180);
  g.fillRoundedRect(-3, -108, 12, 12, 2);
  g.fillStyle(0x65503d);
  g.fillRect(0, -105, 6, 6);
  // Shoulder plate and small etched lines catch the moonlight.
  poly([-29, -163, -25, -174, -12, -174, -6, -166, -18, -154], 0x4d5262);
  poly([-28, -163, -24, -171, -13, -171, -9, -165, -19, -160], 0x778392);
  line(-25, -167, -14, -169, 1.4, 0xc5c5cd);
  oval(-15, -164, 3, 3, accent);

  // Clothing is independent of face, hair and combat animation.
  if (a.fighter.appearance?.outfitStyle === "jacket") {
    poly(
      [-23, -165, -12, -174, 12, -173, 24, -162, 19, -105, -20, -105],
      cloth,
    );
    poly([-12, -173, 0, -153, -6, -136, -20, -164], lightCloth);
    poly([12, -173, 0, -153, 7, -135, 20, -163], darkCloth);
    line(0, -152, 0, -106, 2, 0xd9d9df);
    for (const x of [-13, 12]) line(x - 4, -125, x + 4, -125, 2, accent);
    line(-20, -107, 19, -107, 4, darkCloth);
  } else if (a.fighter.appearance?.outfitStyle === "robe") {
    poly(
      [
        -24,
        -167,
        -10,
        -176,
        14,
        -173,
        25,
        -161,
        23,
        -115,
        33 - walk * 4,
        -58,
        -30 - walk * 4,
        -58,
        -22,
        -118,
      ],
      cloth,
    );
    poly([-10, -175, 12, -171, -7, -124, -17, -129], lightCloth);
    poly([12, -170, 23, -162, 6, -114, -3, -123], darkCloth);
    line(-21, -117, 23, -116, 9, accent);
    line(-8, -106, -15 - walk * 4, -62, 2, lightCloth);
    line(9, -106, 20 - walk * 4, -62, 2, darkCloth);
  }

  // Neck/chin shadows and a three-quarter face with two distinct eyes.
  poly([-7, -191, 10, -192, 10, -174, 2, -166, -8, -176], p.skin);
  poly([-7, -187, 10, -191, 10, -180, -4, -177], p.shadow);
  oval(-1, -215, 49, 63, hair);
  poly(
    [
      -19, -225, -7, -237, 12, -233, 23, -219, 20, -199, 12, -186, 3, -181, -10,
      -188, -18, -203,
    ],
    p.skin,
  );
  poly(
    [16, -225, 23, -219, 20, -199, 12, -186, 3, -181, 10, -196, 14, -212],
    mix(p.skin, p.shadow, 0.45),
  );
  poly(
    [-17, -212, -13, -201, -10, -190, -4, -185, -10, -188, -18, -203],
    p.shadow,
  );
  oval(-18, -207, 9, 14, p.skin);
  line(-19, -210, -16, -205, 1.4, p.shadow);
  // Cheekbone and lower eyelid highlights soften the angular face.
  oval(7, -201, 16, 5, 0xffe0c8, 0.4);
  const eye = (x: number, y: number, width: number) => {
    poly(
      [
        x - width / 2,
        y,
        x - width / 4,
        y - 2.3,
        x + width / 2,
        y - 1,
        x + width / 3,
        y + 3,
        x - width / 3,
        y + 2.5,
      ],
      0xf8ede2,
    );
    oval(x + 1, y + 0.6, 4.5, 5.5, mix(accent, 0x273043, 0.42));
    oval(x + 1.3, y + 0.6, 2, 4.2, 0x172031);
    oval(x + 0.2, y - 0.7, 1.5, 1.5, 0xffffff);
    line(x - width / 2, y - 0.6, x + width / 2, y - 1.4, 1.7, 0x352b35);
    line(x - width / 3, y + 3.6, x + width / 3, y + 3.5, 0.7, p.shadow);
  };
  if (!customFaceLoaded) {
    if (a.state === "ko") {
      line(-8, -209, 0, -208, 1.4, 0x352b35);
      line(9, -209, 18, -210, 1.4, 0x352b35);
    } else {
      eye(-4, -210, 11);
      eye(13, -210.5, 10);
    }
    line(-10, -216, 0, -215, 2, mix(hair, 0x211a23, 0.5));
    line(8, -215, 18, -217, 2, mix(hair, 0x211a23, 0.5));
    // Nose bridge, nostril, lips and chin, kept independent of team colors.
    line(5, -208, 7, -199, 1, p.shadow);
    line(7, -199, 4, -198, 1.2, p.shadow);
    line(6, -198, 9, -198.5, 1, mix(p.shadow, 0x583740, 0.25));
    line(1, -191.5, 10, -192, 1.2, 0x965f62);
    line(3, -189.8, 8, -190, 0.8, 0xffe1cd);
    line(1, -184.7, 5, -184.2, 0.8, p.shadow);
  }

  // Layered hair locks (small tapered strands instead of oversized triangles).
  poly(
    [
      -23, -220, -20, -238, -7, -247, 7, -247, 19, -238, 25, -222, 15, -226, 6,
      -231, -6, -229, -15, -213,
    ],
    hair,
  );
  poly(
    [-20, -235, -8, -242, 2, -240, -4, -225, -10, -217, -9, -230],
    hairLight,
  );
  poly([-7, -243, 7, -241, 13, -229, 7, -216, 4, -229], hair);
  poly(
    [7, -243, 17, -237, 22, -224, 18, -214, 14, -228],
    mix(hair, accent, 0.2),
  );
  poly([-22, -229, -15, -223, -16, -202, -21, -191, -25, -209], hair);
  line(-17, -232, -19, -214, 1.3, hairLight);
  line(-8, -239, -8, -228, 1, mix(hairLight, 0xffffff, 0.2));
  line(10, -237, 16, -226, 1.2, hairLight);
  if (a.fighter.id === "ren") {
    line(-18, -224, 21, -225, 3, 0x253246);
    line(-16, -224.5, 19, -225.5, 0.8, accent);
  }
  if (faceId === "kuro" && !customFaceLoaded) {
    line(-8, -205, -3, -197, 0.9, p.shadow);
    oval(-18, -199, 3, 4, 0xbdb3d2);
  }
  if (a.fighter.id === "yuki") {
    oval(-17, -228, 7, 7, 0xc9ece6);
    oval(-17, -228, 3, 3, accent);
  }

  // Leading arm, leather gauntlet, articulated hand and steel blade.
  const elbowX = a.state === "ko" ? -5 : active ? 40 : guard ? 30 : 35;
  const elbowY = active ? -158 : guard ? -155 : -141;
  const handX = a.state === "ko" ? -15 : active ? 74 : guard ? 22 : 44;
  const handY = active
    ? -151
    : guard
      ? -191
      : a.state === "taunt"
        ? -223
        : a.state === "focus"
          ? -151
          : -119;
  limb(22, -163, elbowX, elbowY, 19, cloth);
  limb(elbowX, elbowY, handX, handY, 14, lightCloth);
  oval(23, -163, 20, 22, darkCloth);
  line(21, -171, 30, -165, 2, accent);
  limb((elbowX + handX) / 2, (elbowY + handY) / 2, handX, handY, 15, 0x27303f);
  line(
    (elbowX + handX) / 2 - 2,
    (elbowY + handY) / 2,
    handX - 2,
    handY,
    2,
    0x71808c,
  );
  oval(handX, handY, 13, 15, p.skin);
  line(handX + 1, handY - 3, handX + 4, handY + 3, 1, p.shadow);
  line(handX - 2, handY - 2, handX, handY + 4, 1, p.shadow);
  g.save();
  g.translateCanvas(handX, handY);
  g.rotateCanvas(
    active ? 1.12 : guard ? 0.72 : a.state === "taunt" ? 1.2 : 0.36,
  );
  poly([-3, 14, 3, 14, 3, -11, -3, -11], 0x262336);
  for (let i = 0; i < 4; i++) line(-3, i * 4, 3, i * 4 - 2, 1, accent, 0.8);
  line(-11, -10, 11, -10, 3, 0xc0ab80);
  poly([-3, -12, 3, -12, 3, -81, 0, -94, -3, -81], 0x8697a9);
  poly([0, -12, 3, -12, 3, -81, 0, -94], 0xe0e9ed);
  line(0, -16, 0, -80, 1, 0xfaf3df, 0.9);
  g.restore();
  g.restore();
}
