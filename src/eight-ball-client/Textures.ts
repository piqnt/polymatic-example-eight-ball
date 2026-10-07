import { CanvasSource, Texture } from "pixi.js";

import { type Table } from "../eight-ball/BilliardContext";

/**
 * Textures are painted procedurally on a 2d canvas, so the game has no image assets.
 *
 * Table units are meters, see PoolTable.
 */

/** Table texture pixels per meter. */
export const TABLE_RESOLUTION = 600;
/** Width of the wooden frame outside the cushions, in meters. */
export const FRAME_WIDTH = 0.12;
/** Width and height of pocket, light and shadow textures, in pixels. */
const BALL_SIZE = 128;
/** Length of the cue stick, in meters, and its texture size in pixels. */
export const CUE_LENGTH = 1.45;
export const CUE_WIDTH = 0.028;
const CUE_PIXELS = 1024;

/** Pool ball colors, and the number on each color, see RollingBall. */
export const BALL_PAINT: Record<string, { color: string; number: number }> = {
  yellow: { color: "#f3c41c", number: 1 },
  blue: { color: "#1c4fb8", number: 2 },
  red: { color: "#d8291d", number: 3 },
  purple: { color: "#5c2d8c", number: 4 },
  orange: { color: "#f07c14", number: 5 },
  green: { color: "#16803c", number: 6 },
  burgundy: { color: "#7d1f24", number: 7 },
};

/** The table outside the cushions and the cloth under them: frame, cloth, sights and spots. */
export function makeTableTexture(table: Table) {
  const k = TABLE_RESOLUTION;
  const rw = table.pocketRadius * 1.5;
  // cloth and frame half sizes
  const cw = table.width / 2 + rw;
  const ch = table.height / 2 + rw;
  const fw = cw + FRAME_WIDTH;
  const fh = ch + FRAME_WIDTH;
  const { canvas, ctx } = makeCanvas(Math.ceil(2 * fw * k), Math.ceil(2 * fh * k));
  const random = seeded(8);

  // draw in meters, the table center at the origin
  ctx.setTransform(k, 0, 0, k, fw * k, fh * k);

  // frame: mahogany, grain along each rail, mitred at the corners
  const radius = FRAME_WIDTH * 0.6;
  roundRect(ctx, -fw, -fh, 2 * fw, 2 * fh, radius);
  ctx.fillStyle = "#4a2213";
  ctx.fill();
  for (const side of ["top", "bottom", "left", "right"] as const) {
    ctx.save();
    roundRect(ctx, -fw, -fh, 2 * fw, 2 * fh, radius);
    ctx.clip();
    ctx.beginPath();
    const [sx, sy] = side === "left" ? [-1, 1] : side === "right" ? [1, 1] : side === "top" ? [1, -1] : [1, 1];
    if (side === "top" || side === "bottom") {
      ctx.moveTo(-fw, sy * fh);
      ctx.lineTo(fw, sy * fh);
      ctx.lineTo(cw, sy * ch);
      ctx.lineTo(-cw, sy * ch);
    } else {
      ctx.moveTo(sx * fw, -fh);
      ctx.lineTo(sx * fw, fh);
      ctx.lineTo(sx * cw, ch);
      ctx.lineTo(sx * cw, -ch);
    }
    ctx.closePath();
    ctx.clip();
    const band = FRAME_WIDTH + 0.001;
    if (side === "top") woodGrain(ctx, random, -fw, -fh, 2 * fw, band, false);
    if (side === "bottom") woodGrain(ctx, random, -fw, ch, 2 * fw, band, false);
    if (side === "left") woodGrain(ctx, random, -fw, -fh, band, 2 * fh, true);
    if (side === "right") woodGrain(ctx, random, cw, -fh, band, 2 * fh, true);
    ctx.restore();
  }
  // varnish: light from above the table, a bevel on both edges
  const varnish = ctx.createLinearGradient(0, -fh, 0, fh);
  varnish.addColorStop(0, "rgba(255, 220, 190, 0.16)");
  varnish.addColorStop(0.5, "rgba(255, 220, 190, 0.02)");
  varnish.addColorStop(1, "rgba(0, 0, 0, 0.18)");
  roundRect(ctx, -fw, -fh, 2 * fw, 2 * fh, radius);
  ctx.fillStyle = varnish;
  ctx.fill();
  roundRect(ctx, -fw + 0.004, -fh + 0.004, 2 * fw - 0.008, 2 * fh - 0.008, radius);
  ctx.strokeStyle = "rgba(255, 210, 170, 0.35)";
  ctx.lineWidth = 0.004;
  ctx.stroke();
  roundRect(ctx, -fw, -fh, 2 * fw, 2 * fh, radius);
  ctx.strokeStyle = "rgba(20, 8, 2, 0.9)";
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // sights: three between each pair of pockets
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue;
    const x = -table.width / 2 + (i * table.width) / 8;
    diamond(ctx, x, -(ch + FRAME_WIDTH / 2), true);
    diamond(ctx, x, +(ch + FRAME_WIDTH / 2), true);
  }
  for (let i = 1; i < 4; i++) {
    const y = -table.height / 2 + (i * table.height) / 4;
    diamond(ctx, -(cw + FRAME_WIDTH / 2), y, false);
    diamond(ctx, +(cw + FRAME_WIDTH / 2), y, false);
  }

  // cloth, with a shadow cast by the frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(-cw, -ch, 2 * cw, 2 * ch);
  ctx.clip();
  ctx.fillStyle = "#1f7047";
  ctx.fillRect(-cw, -ch, 2 * cw, 2 * ch);
  // brushed fibers along the table, batched by color
  const fibers = ["#2a8255", "#17613b", "#23764b", "#1b6840"];
  const count = (2 * cw * 2 * ch * 30000) / fibers.length;
  ctx.lineWidth = 0.0012;
  ctx.globalAlpha = 0.55;
  for (const color of fibers) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = -cw + random() * 2 * cw;
      const y = -ch + random() * 2 * ch;
      const length = 0.004 + random() * 0.008;
      const angle = (random() - 0.5) * 0.5;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  addNoise(ctx, 8, random);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-cw, -ch, 2 * cw, 2 * ch);
  ctx.clip();
  // an overhead lamp, lighter in the middle
  const lamp = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 1.1);
  lamp.addColorStop(0, "rgba(255, 255, 220, 0.1)");
  lamp.addColorStop(0.6, "rgba(0, 0, 0, 0)");
  lamp.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = lamp;
  ctx.fillRect(-cw, -ch, 2 * cw, 2 * ch);
  // head and foot spots
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  for (const x of [-table.width / 4, table.width / 4]) {
    ctx.beginPath();
    ctx.arc(x, 0, 0.005, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();

  return { texture: toTexture(canvas), left: -fw, top: -fh };
}

/** A pocket seen from above: a dark hole with a leather rim. */
export function makePocketTexture() {
  const { canvas, ctx } = makeDiscCanvas(BALL_SIZE);
  const rim = ctx.createRadialGradient(0, 0, 0.75, 0, 0, 1);
  rim.addColorStop(0, "#3b2718");
  rim.addColorStop(0.5, "#24160d");
  rim.addColorStop(1, "#120a05");
  ctx.fillStyle = rim;
  ctx.fillRect(-1, -1, 2, 2);
  const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.85);
  hole.addColorStop(0, "#000000");
  hole.addColorStop(0.7, "#060606");
  hole.addColorStop(1, "#1a1a1a");
  ctx.beginPath();
  ctx.arc(0, 0, 0.85, 0, 2 * Math.PI);
  ctx.fillStyle = hole;
  ctx.fill();
  return toTexture(canvas);
}

/** Lighting over a ball, not rotated with it: a highlight from the lamp and a darker rim. */
export function makeShineTexture() {
  const { canvas, ctx } = makeDiscCanvas(BALL_SIZE);
  const light = ctx.createRadialGradient(-0.35, -0.4, 0, -0.1, -0.1, 1.15);
  light.addColorStop(0, "rgba(255, 255, 255, 0.75)");
  light.addColorStop(0.12, "rgba(255, 255, 255, 0.3)");
  light.addColorStop(0.45, "rgba(255, 255, 255, 0)");
  light.addColorStop(0.8, "rgba(0, 0, 0, 0.12)");
  light.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = light;
  ctx.fillRect(-1, -1, 2, 2);
  return toTexture(canvas);
}

/** A soft shadow under a ball. */
export function makeShadowTexture() {
  const { canvas, ctx } = makeCanvas(BALL_SIZE, BALL_SIZE);
  ctx.setTransform(BALL_SIZE / 2, 0, 0, BALL_SIZE / 2, BALL_SIZE / 2, BALL_SIZE / 2);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  shadow.addColorStop(0.6, "rgba(0, 0, 0, 0.3)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(-1, -1, 2, 2);
  return toTexture(canvas);
}

/**
 * The cue stick, from the tip at x = 0 to the butt at the right end, tapering from tip to butt.
 * Its size in meters is CUE_LENGTH by CUE_WIDTH.
 */
export function makeCueTexture() {
  const width = CUE_PIXELS;
  const height = Math.round((CUE_PIXELS * CUE_WIDTH) / CUE_LENGTH) * 2;
  const { canvas, ctx } = makeCanvas(width, height);
  // x along the stick in 0..1, y across it in -1..1
  ctx.setTransform(width, 0, 0, height / 2, 0, height / 2);

  const half = (x: number) => 0.42 + 0.58 * x;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(0, -half(0));
    ctx.lineTo(1, -half(1));
    ctx.lineTo(1, half(1));
    ctx.lineTo(0, half(0));
    ctx.closePath();
  };

  // sections along the stick
  const band = (from: number, to: number, fill: string | CanvasGradient) => {
    ctx.save();
    outline();
    ctx.clip();
    ctx.fillStyle = fill;
    ctx.fillRect(from, -1, to - from, 2);
    ctx.restore();
  };
  const maple = ctx.createLinearGradient(0, 0, 0.6, 0);
  maple.addColorStop(0, "#f2dcb0");
  maple.addColorStop(1, "#dcb67c");
  band(0, 0.012, "#3d6fb0"); // chalked tip
  band(0.012, 0.035, "#f4f1e8"); // ferrule
  band(0.035, 0.6, maple); // shaft
  band(0.6, 0.615, "#c9ccd1"); // joint
  band(0.615, 0.78, "#2b140b"); // forearm
  band(0.78, 0.93, "#1b1b1d"); // wrap
  band(0.93, 0.99, "#2b140b"); // butt
  band(0.99, 1, "#0c0c0c"); // bumper

  // points of maple into the forearm
  ctx.save();
  outline();
  ctx.clip();
  ctx.fillStyle = "#dcb67c";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.615, side * 0.1);
    ctx.lineTo(0.615, side * 1);
    ctx.lineTo(0.72, side * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  // linen wrap
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 0.0015;
  for (let x = 0.782; x < 0.93; x += 0.004) {
    ctx.beginPath();
    ctx.moveTo(x, -1);
    ctx.lineTo(x + 0.002, 1);
    ctx.stroke();
  }
  // round: lit along the top, shaded along the bottom
  const round = ctx.createLinearGradient(0, -1, 0, 1);
  round.addColorStop(0, "rgba(255, 255, 255, 0.35)");
  round.addColorStop(0.35, "rgba(255, 255, 255, 0.05)");
  round.addColorStop(0.7, "rgba(0, 0, 0, 0.15)");
  round.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = round;
  ctx.fillRect(0, -1, 1, 2);
  ctx.restore();

  return toTexture(canvas);
}

function woodGrain(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  x: number,
  y: number,
  width: number,
  height: number,
  vertical: boolean,
) {
  ctx.fillStyle = vertical ? "#4f2515" : "#4a2213";
  ctx.fillRect(x, y, width, height);
  const along = vertical ? height : width;
  const across = vertical ? width : height;
  const start = vertical ? y : x;
  const offset = vertical ? x : y;
  for (let i = 0; i < 160; i++) {
    const c = offset + random() * across;
    const amplitude = random() * 0.004;
    const frequency = 4 + random() * 10;
    const phase = random() * 2 * Math.PI;
    ctx.beginPath();
    for (let t = start; t <= start + along; t += 0.01) {
      const d = c + amplitude * Math.sin(t * frequency + phase);
      if (vertical) ctx.lineTo(d, t);
      else ctx.lineTo(t, d);
    }
    ctx.strokeStyle = random() < 0.6 ? "rgba(20, 6, 2, 0.35)" : "rgba(140, 70, 40, 0.25)";
    ctx.lineWidth = 0.0005 + random() * 0.0015;
    ctx.stroke();
  }
}

/** Mother of pearl sight, long across the rail it is set in. */
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, horizontalRail: boolean) {
  const a = 0.007;
  const b = 0.012;
  const [dx, dy] = horizontalRail ? [a, b] : [b, a];
  ctx.beginPath();
  ctx.moveTo(x, y - dy);
  ctx.lineTo(x + dx, y);
  ctx.lineTo(x, y + dy);
  ctx.lineTo(x - dx, y);
  ctx.closePath();
  const pearl = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
  pearl.addColorStop(0, "#fffaf0");
  pearl.addColorStop(1, "#cfc6b4");
  ctx.fillStyle = pearl;
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 8, 2, 0.8)";
  ctx.lineWidth = 0.0012;
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

/** Canvas for a disc texture, transformed to a unit circle at the center and clipped to it. */
function makeDiscCanvas(size: number) {
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.setTransform(size / 2, 0, 0, size / 2, size / 2, size / 2);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, 2 * Math.PI);
  ctx.clip();
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement) {
  return new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true }) });
}

/** Adds grain to every painted pixel. */
function addNoise(ctx: CanvasRenderingContext2D, amount: number, random: () => number) {
  const { width, height } = ctx.canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const n = (random() - 0.5) * amount;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
}

/** Seeded random, so textures look the same on every load. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
