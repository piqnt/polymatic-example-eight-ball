import { Middleware } from "polymatic";

import {
  type Ball,
  type BilliardContext,
  type Player,
  type Point,
  type Pocket,
  type Table,
  Color,
  CueStick,
} from "./BilliardContext";
import { CUE_REACH, SHOT_STRENGTH } from "./CueShot";
import { BALL_DAMPING, BALL_DENSITY, BALL_RESTITUTION } from "./Physics";

// the hardest the computer shoots, as a player's drag of 30 cm does, and how hard it breaks, in m/s
const MAX_SPEED = 5;
const BREAK_SPEED = 10;
// how long the computer looks at the table, then lines the shot up, in seconds
const THINK_TIME = 0.6;
const AIM_TIME = 0.7;
// how far off its aim the computer may be, in radians
const AIM_ERROR = 0.006;
// gap kept between a shot's path and the balls it should miss
const CLEARANCE = 0.01;
// thinner cuts than this, 45 degrees, are left out, as the cosine of the cut angle, see OVERCUT
const MIN_CUT = 0.7;
// a side pocket only takes a ball coming at it this straight, as the cosine of the angle from square on
const SIDE_CUT = 0.75;
// speed the object ball has left when it reaches the pocket, in m/s
const SPARE_SPEED = 0.5;
// how close the cue ball may come to a pocket after the hit
const SCRATCH_MARGIN = 0.02;

// Physics steps 20 times a second, so a ball moves a few times its size in a step, and the cue ball touches the
// target later than the ghost ball says, a thinner hit. By the cut angle, in 5 degree steps from straight on, as
// measured: how many degrees further to the side the target goes, and what part of the speed the ghost ball says it
// takes. Past 45 degrees it is mostly luck, and the cue ball can pass through the target.
const OVERCUT = [0, 0.2, 0.4, 0.6, 0.8, 2, 3.8, 7, 10, 13.5];
const TRANSFER = [0.93, 0.93, 0.92, 0.91, 0.89, 0.87, 0.84, 0.77, 0.69, 0.57];

interface Plan {
  // who it plays and the cue ball it shoots, a new plan is made when either changes
  player: Player;
  ball: Ball;
  shot: Point;
  // the ball and pocket it goes for, if any
  target?: Ball;
  pocket?: Pocket;
  // seconds since the turn started
  t: number;
}

interface Choice {
  score: number;
  // where the cue ball is sent, and how fast it leaves
  aim: Point;
  speed: number;
  target?: Ball;
  pocket?: Pocket;
}

const smooth = (u: number) => {
  u = Math.max(0, Math.min(1, u));
  return u * u * (3 - 2 * u);
};

/**
 * The computer player, offline. On its turn it picks a shot, then draws the cue back where you can see, and shoots.
 * Physics, rendering and network agnostic: it reads the balls and emits the same cue-shot a player would. It plays
 * the player whose id is the context's `computer`.
 *
 * For each of its balls, the 8-ball once they are gone, and each pocket, it finds where the cue ball has to touch the
 * ball to send it into the pocket's mouth, and keeps the shots where nothing is in the way, the cut is not too thin,
 * the speed is not too much, and the cue ball does not go on into a pocket. It takes the straightest and shortest. It
 * breaks hard at the front of the rack, and when there is no clear shot it hits the nearest of its balls full on. Its
 * aim is a little off, AIM_ERROR, so it can be beaten.
 */
export class Computer extends Middleware<BilliardContext> {
  plan: Plan | null = null;
  // the stick it shows, to tell it from a player's
  cue: CueStick | null = null;

  constructor() {
    super();
    this.on("frame-loop", this.handleFrameLoop);
  }

  handleFrameLoop = (ev: { dt: number }) => {
    const context = this.context;
    const { computer, players, turn, balls, table } = context;
    const player = computer && players?.find((p) => p.id === computer);
    // after a scratch the cue ball is put back a moment later
    const white = balls?.find((ball) => ball.color === Color.white);
    const ready = player && white && table && context.gameStarted && !context.gameOver && !context.shotInProgress;
    if (!ready || !turn?.current || turn.current !== player.turn) {
      this.stop();
      return;
    }

    if (!this.plan || this.plan.ball !== white || this.plan.player !== player) {
      this.plan = { ...this.think(white, player.color), player, t: 0 };
    }
    const plan = this.plan;
    plan.t += ev.dt / 1000;

    // draws back from the ball to the shot, as a player's drag does
    const u = smooth((plan.t - THINK_TIME) / AIM_TIME);
    if (u > 0) {
      if (!this.cue) this.cue = new CueStick();
      const cue = this.cue;
      const reach = (CUE_REACH / SHOT_STRENGTH) * u;
      cue.ball = white;
      cue.start.x = white.position.x;
      cue.start.y = white.position.y;
      cue.end.x = cue.start.x + plan.shot.x * reach;
      cue.end.y = cue.start.y + plan.shot.y * reach;
      context.cue = cue;
    }

    if (plan.t > THINK_TIME + AIM_TIME + 0.2) {
      this.stop();
      this.emit("cue-shot", { ball: white, shot: plan.shot });
    }
  };

  /** Forgets the shot it was lining up, and takes its cue away. */
  stop() {
    this.plan = null;
    if (this.cue && this.context.cue === this.cue) {
      this.context.cue = null;
    }
    this.cue = null;
  }

  think(white: Ball, color: string): Omit<Plan, "player" | "t"> {
    const { balls, pockets, table } = this.context;
    const others = balls.filter((ball) => ball !== white);
    const eight = others.find((ball) => ball.color === Color.black);
    // the 8-ball once none of its own are left
    let own = others.filter((ball) => Color.is(ball.color, color));
    if (!own.length && eight) own = [eight];
    if (!own.length) own = others;

    let best: Choice | null = null;
    if (racked(others)) {
      best = breakShot(white, others);
    } else {
      for (const target of own) {
        for (const pocket of pockets) {
          const choice = pot(white, target, pocket, balls, pockets, table, target !== eight ? eight : null);
          if (choice && (!best || choice.score > best.score)) best = choice;
        }
      }
    }
    if (!best) {
      best = safety(white, own, balls);
    }

    const mass = BALL_DENSITY * Math.PI * white.radius ** 2;
    const from = white.position;
    const angle = Math.atan2(best.aim.y - from.y, best.aim.x - from.x) + (Math.random() - 0.5) * 2 * AIM_ERROR;
    const impulse = best.speed * mass;
    return {
      ball: white,
      shot: { x: Math.cos(angle) * impulse, y: Math.sin(angle) * impulse },
      target: best.target,
      pocket: best.pocket,
    };
  }
}

/** Reads a table by the cut, its cosine, in 5 degree steps. */
function byCut(table: number[], cos: number) {
  const i = Math.min(table.length - 1, (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI / 5);
  const k = Math.floor(i);
  return table[k] + ((table[k + 1] ?? table[k]) - table[k]) * (i - k);
}

/** How far further to the side the target goes, in radians. */
const overcut = (cos: number) => (byCut(OVERCUT, cos) * Math.PI) / 180;
const transfer = (cos: number) => byCut(TRANSFER, cos);

/** Nobody has broken the rack yet, all the balls are still together. */
function racked(balls: Ball[]) {
  if (balls.length < 15) return false;
  const center = {
    x: balls.reduce((sum, ball) => sum + ball.position.x, 0) / balls.length,
    y: balls.reduce((sum, ball) => sum + ball.position.y, 0) / balls.length,
  };
  return balls.every((ball) => distance(ball.position, center) < 6 * ball.radius);
}

/** Hard into the ball at the front of the rack. */
function breakShot(white: Ball, others: Ball[]): Choice | null {
  const apex = nearest(white.position, others);
  if (!apex) return null;
  return { score: 0, aim: apex.position, speed: BREAK_SPEED, target: apex };
}

/**
 * Sending the target into the pocket, a cut shot: the cue ball goes to the ghost ball, where it touches the target on
 * the line from the pocket. Shots that are blocked, too thin, too fast, or that would put the cue ball in a pocket or
 * knock the 8-ball, are left out or count for less.
 */
function pot(
  white: Ball,
  target: Ball,
  pocket: Pocket,
  balls: Ball[],
  pockets: Pocket[],
  table: Table,
  eight: Ball | null,
): Choice | null {
  const r = white.radius;
  const from = white.position;
  const at = target.position;

  // the way the target has to go, and how far
  const side = isSide(pocket, table);
  const end = mouth(pocket, table);
  const want = unit(end.x - at.x, end.y - at.y);
  const travel = distance(at, end);
  if (side && Math.abs(want.y) < SIDE_CUT) return null;

  // the target goes further to the side than the ghost ball says, so the cut is aimed that much fuller
  let toPocket = want;
  let ghost: Point;
  let dir: Point;
  let cos: number;
  for (let i = 0; i < 3; i++) {
    // where the cue ball is when it touches the target
    ghost = { x: at.x - toPocket.x * 2 * r, y: at.y - toPocket.y * 2 * r };
    dir = unit(ghost.x - from.x, ghost.y - from.y);
    cos = dir.x * toPocket.x + dir.y * toPocket.y;
    const across = dir.x * want.x + dir.y * want.y;
    const toward = unit(dir.x - across * want.x, dir.y - across * want.y);
    const turn = overcut(cos);
    toPocket = {
      x: want.x * Math.cos(turn) + toward.x * Math.sin(turn),
      y: want.y * Math.cos(turn) + toward.y * Math.sin(turn),
    };
  }

  // the cue ball can not be inside a cushion
  if (Math.abs(ghost.x) > table.width / 2 - r || Math.abs(ghost.y) > table.height / 2 - r) return null;
  const length = distance(from, ghost);
  if (length < r * 0.1) return null;
  if (cos < MIN_CUT) return null;

  for (const ball of balls) {
    if (ball === white || ball === target) continue;
    if (segmentDistance(ball.position, from, ghost) < 2 * r + CLEARANCE) return null;
    if (segmentDistance(ball.position, at, end) < 2 * r + CLEARANCE) return null;
  }

  // enough speed for the target to reach the pocket with some to spare, and to bring the cue ball there
  const hit = (BALL_DAMPING * travel + SPARE_SPEED) / (((cos * (1 + BALL_RESTITUTION)) / 2) * transfer(cos));
  const speed = hit + BALL_DAMPING * length;
  if (speed > MAX_SPEED) return null;

  let score = (cos * cos) / (1 + 0.5 * (length + travel));

  // the cue ball goes on along the tangent with the sideways part of its speed
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  if (sin > 0.05) {
    const tangent = unit(dir.x - cos * toPocket.x, dir.y - cos * toPocket.y);
    const path = roll(ghost, tangent, (hit * sin) / BALL_DAMPING, table, r);
    for (const [a, b] of path) {
      for (const p of pockets) {
        if (segmentDistance(p.position, a, b) < r + p.radius + SCRATCH_MARGIN) return null;
      }
      if (eight && segmentDistance(eight.position, a, b) < 2 * r + CLEARANCE) score *= 0.3;
    }
  }

  return { score, aim: ghost, speed, target, pocket };
}

/** A side pocket, between the corners. */
const isSide = (pocket: Pocket, table: Table) => Math.abs(pocket.position.x) < table.width / 4;

/**
 * The middle of the pocket's mouth, between the ends of the cushions, see PoolTable. A ball is in when it touches the
 * pocket, which is behind the mouth, but going for the pocket itself it would hit a cushion on the way.
 */
function mouth(pocket: Pocket, table: Table): Point {
  const { x, y } = pocket.position;
  if (isSide(pocket, table)) {
    return { x, y: (Math.sign(y) * table.height) / 2 };
  }
  const inset = pocket.radius / Math.SQRT2;
  return { x: Math.sign(x) * (table.width / 2 - inset), y: Math.sign(y) * (table.height / 2 - inset) };
}

/** No clear shot: a full hit on the nearest of its balls it can reach, or the nearest at all. */
function safety(white: Ball, targets: Ball[], balls: Ball[]): Choice {
  const from = white.position;
  const sorted = [...targets].sort((a, b) => distance(from, a.position) - distance(from, b.position));
  const clear = sorted.find((target) =>
    balls.every(
      (ball) =>
        ball === white ||
        ball === target ||
        segmentDistance(ball.position, from, target.position) >= 2 * white.radius + CLEARANCE,
    ),
  );
  const target = clear ?? sorted[0];
  if (!target) {
    // nothing to hit, it must still shoot
    return { score: 0, aim: { x: 0, y: 0 }, speed: 1 };
  }
  const speed = Math.min(MAX_SPEED, BALL_DAMPING * distance(from, target.position) + 1.5);
  return { score: 0, aim: target.position, speed, target };
}

/** The way a ball rolls from a point, off the cushions, until it stops, as straight segments. */
function roll(start: Point, dir: Point, length: number, table: Table, r: number): [Point, Point][] {
  const w = table.width / 2 - r;
  const h = table.height / 2 - r;
  const path: [Point, Point][] = [];
  let a = { ...start };
  let d = { ...dir };
  for (let i = 0; i < 4 && length > 1e-3; i++) {
    const tx = d.x > 0 ? (w - a.x) / d.x : d.x < 0 ? (-w - a.x) / d.x : Infinity;
    const ty = d.y > 0 ? (h - a.y) / d.y : d.y < 0 ? (-h - a.y) / d.y : Infinity;
    const t = Math.max(0, Math.min(length, tx, ty));
    const b = { x: a.x + d.x * t, y: a.y + d.y * t };
    path.push([a, b]);
    length -= t;
    if (t === tx) d = { x: -d.x, y: d.y };
    if (t === ty) d = { x: d.x, y: -d.y };
    a = b;
  }
  return path;
}

function nearest(point: Point, balls: Ball[]) {
  let best: Ball | null = null;
  for (const ball of balls) {
    if (!best || distance(point, ball.position) < distance(point, best.position)) best = ball;
  }
  return best;
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function unit(x: number, y: number): Point {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Distance from a point to the segment from a to b. */
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1e-9)));
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
}
