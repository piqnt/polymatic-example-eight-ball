import { CanvasSource, Texture } from "pixi.js";

import { Color } from "../eight-ball/BilliardContext";
import { BALL_PAINT } from "./Textures";

/** Width and height of a ball's texture, in pixels. It is repainted as the ball rolls. */
const SIZE = 64;
/** Size of the number bitmap sampled on each side of the ball, in pixels. */
const NUMBER_SIZE = 48;
// the number disc, as an angle from its center on the sphere
const DISC_ANGLE = 0.46;
const DISC_COS = Math.cos(DISC_ANGLE);
const DISC_SIN = Math.sin(DISC_ANGLE);
// half width of a stripe, along the axis it is wrapped around
const STRIPE = 0.55;

const IVORY = [247, 244, 234];
const INK = [21, 21, 21];

/**
 * A pool ball that rolls: it keeps its orientation, turned as it moves across the table, and paints what is facing up
 * into its texture. The ball has a number on two opposite sides, and a stripe around it through both numbers.
 *
 * Coordinates are the table's, x right and y down on screen, with z into the table, so the half of the ball that is
 * seen has negative z.
 */
export class RollingBall {
  texture: Texture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: ImageData;

  fill: number[];
  stripe: boolean;
  // alpha of the number drawn on the discs, none for the cue ball
  number: Uint8ClampedArray | null;

  // orientation, a unit quaternion turning ball coordinates into table coordinates
  q = [1, 0, 0, 0];
  dirty = true;

  constructor(color: string) {
    const [name, kind] = color.split("-");
    const paint = BALL_PAINT[name];
    const black = color === Color.black;
    const white = color === Color.white;
    this.stripe = kind === Color.stripe;
    this.fill = white ? IVORY : black ? [18, 18, 18] : hexToRgb(paint?.color ?? "#888888");
    this.number = white ? null : numberBitmap(black ? 8 : (paint?.number ?? 0) + (this.stripe ? 8 : 0));

    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext("2d")!;
    this.image = this.ctx.createImageData(SIZE, SIZE);
    this.texture = new Texture({ source: new CanvasSource({ resource: this.canvas, autoGenerateMipmaps: true }) });
    this.paint();
  }

  /** The ball moved by dx, dy without slipping, so it turned by the distance over its radius, across the move. */
  roll(dx: number, dy: number, radius: number) {
    const distance = Math.hypot(dx, dy);
    if (distance < radius * 1e-3) return;
    // axis is up out of the table crossed with the move, up being -z
    const ax = dy / distance;
    const ay = -dx / distance;
    const half = distance / radius / 2;
    const s = Math.sin(half);
    const [w, x, y, z] = this.q;
    const dw = Math.cos(half);
    const dxq = ax * s;
    const dyq = ay * s;
    // q = dq * q, dq has no z part
    const nw = dw * w - dxq * x - dyq * y;
    const nx = dw * x + dxq * w + dyq * z;
    const ny = dw * y + dyq * w - dxq * z;
    const nz = dw * z + dxq * y - dyq * x;
    const n = Math.hypot(nw, nx, ny, nz);
    this.q = [nw / n, nx / n, ny / n, nz / n];
    this.dirty = true;
  }

  /** Repaints the texture if the ball turned since the last paint. */
  update() {
    if (!this.dirty) return;
    this.paint();
    this.texture.source.update();
  }

  paint() {
    this.dirty = false;
    const [w, x, y, z] = this.q;
    // rotation matrix, its transpose takes a table point into ball coordinates
    const r00 = 1 - 2 * (y * y + z * z);
    const r01 = 2 * (x * y - w * z);
    const r02 = 2 * (x * z + w * y);
    const r10 = 2 * (x * y + w * z);
    const r11 = 1 - 2 * (x * x + z * z);
    const r12 = 2 * (y * z - w * x);
    const r20 = 2 * (x * z - w * y);
    const r21 = 2 * (y * z + w * x);
    const r22 = 1 - 2 * (x * x + y * y);

    const data = this.image.data;
    const half = SIZE / 2;
    const [fr, fg, fb] = this.fill;
    for (let j = 0; j < SIZE; j++) {
      const py = (j + 0.5 - half) / half;
      for (let i = 0; i < SIZE; i++) {
        const px = (i + 0.5 - half) / half;
        const k = (j * SIZE + i) * 4;
        const d2 = px * px + py * py;
        // antialiased edge
        const cover = clamp((1 - Math.sqrt(d2)) * half + 0.5);
        if (cover <= 0) {
          data[k + 3] = 0;
          continue;
        }
        const pz = -Math.sqrt(Math.max(0, 1 - d2));
        const bx = r00 * px + r10 * py + r20 * pz;
        const by = r01 * px + r11 * py + r21 * pz;
        const bz = r02 * px + r12 * py + r22 * pz;

        let cr = fr;
        let cg = fg;
        let cb = fb;
        if (this.stripe) {
          // white either side of the band
          const t = clamp((Math.abs(by) - STRIPE) * half * 1.5 + 0.5);
          cr += (IVORY[0] - cr) * t;
          cg += (IVORY[1] - cg) * t;
          cb += (IVORY[2] - cb) * t;
        }
        if (this.number) {
          const t = clamp((Math.abs(bz) - DISC_COS) * half * 3 + 0.5);
          if (t > 0) {
            cr += (IVORY[0] - cr) * t;
            cg += (IVORY[1] - cg) * t;
            cb += (IVORY[2] - cb) * t;
            // the number reads the right way round on both sides
            const u = ((bz < 0 ? bx : -bx) / DISC_SIN + 1) / 2;
            const v = (by / DISC_SIN + 1) / 2;
            const ni = Math.min(NUMBER_SIZE - 1, Math.max(0, Math.floor(u * NUMBER_SIZE)));
            const nj = Math.min(NUMBER_SIZE - 1, Math.max(0, Math.floor(v * NUMBER_SIZE)));
            const a = (this.number[nj * NUMBER_SIZE + ni] / 255) * t;
            cr += (INK[0] - cr) * a;
            cg += (INK[1] - cg) * a;
            cb += (INK[2] - cb) * a;
          }
        }
        data[k] = cr;
        data[k + 1] = cg;
        data[k + 2] = cb;
        data[k + 3] = cover * 255;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  destroy() {
    this.texture.destroy(true);
  }
}

/** The number's alpha, filling the disc it is printed on. */
function numberBitmap(number: number) {
  const canvas = document.createElement("canvas");
  canvas.width = NUMBER_SIZE;
  canvas.height = NUMBER_SIZE;
  const ctx = canvas.getContext("2d")!;
  // the same size as on a ball seen from above, where the disc is 0.44 of the ball
  const size = ((number > 9 ? 0.5 : 0.58) / 0.44) * (NUMBER_SIZE / 2);
  ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(String(number), NUMBER_SIZE / 2, NUMBER_SIZE / 2 + size * 0.07);
  const data = ctx.getImageData(0, 0, NUMBER_SIZE, NUMBER_SIZE).data;
  const alpha = new Uint8ClampedArray(NUMBER_SIZE * NUMBER_SIZE);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return alpha;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function clamp(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
