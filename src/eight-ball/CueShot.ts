import { Middleware } from "polymatic";

import { CueStick, type BilliardContext } from "./BilliardContext";
import { isMyTurn } from "../eight-ball-client/ClientContext";

// the impulse of a shot per meter of drag, and how far the cue is drawn past the ball per meter, the other way
export const SHOT_STRENGTH = 0.05;
export const CUE_REACH = 1.5;

/**
 * Implements cue and shot:
 * - Listens to user pointer input events (from Terminal)
 * - Updates the cue stick object in the context
 * - Emits cue-shot events
 */
export class CueShot extends Middleware<BilliardContext> {
  constructor() {
    super();
    this.on("user-pointer-start", this.handlePointerStart);
    this.on("user-pointer-move", this.handlePointerMove);
    this.on("user-pointer-end", this.handlePointerUp);
    this.on("frame-loop", this.handleFrameLoop);
  }

  handleFrameLoop() {
    const cue = this.context.cue;
    if (!cue || !cue.ball) return;
    cue.start.x = cue.ball.position.x;
    cue.start.y = cue.ball.position.y;
  }

  handlePointerStart(point: { x: number; y: number }) {
    if (!isMyTurn(this.context)) return;
    const ball = this.context.balls.find((ball) => ball.color === "white");
    if (!ball) return;
    const cue = new CueStick();
    cue.ball = ball;
    cue.start.x = ball.position.x;
    cue.start.y = ball.position.y;
    const dx = point.x - cue.start.x;
    const dy = point.y - cue.start.y;
    cue.end.x = cue.start.x - CUE_REACH * dx;
    cue.end.y = cue.start.y - CUE_REACH * dy;
    this.context.cue = cue;
  }

  handlePointerMove(point: { x: number; y: number }) {
    const cue = this.context.cue;
    if (!cue) return;
    const dx = point.x - cue.start.x;
    const dy = point.y - cue.start.y;
    cue.end.x = cue.start.x - CUE_REACH * dx;
    cue.end.y = cue.start.y - CUE_REACH * dy;
  }

  handlePointerUp(point: { x: number; y: number }) {
    const cue = this.context.cue;
    if (!cue) return;
    const dx = point.x - cue.start.x;
    const dy = point.y - cue.start.y;
    cue.end.x = cue.start.x - CUE_REACH * dx;
    cue.end.y = cue.start.y - CUE_REACH * dy;
    const shot = { x: dx * -SHOT_STRENGTH, y: dy * -SHOT_STRENGTH };
    const ball = cue.ball;
    this.context.cue = null;

    if (!isMyTurn(this.context)) return;
    this.emit("cue-shot", { ball, shot });
  }
}
