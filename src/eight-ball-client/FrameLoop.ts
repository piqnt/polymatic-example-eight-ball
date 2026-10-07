import { Middleware } from "polymatic";

export interface FrameLoopEvent {
  dt: number;
  now: number;
}

/**
 * Implements variable-time game loop. It sends frame-loop, and then frame-after, to all middlewares in each frame.
 */
export class FrameLoop extends Middleware {
  lastTime = 0;

  // reuse object
  event: FrameLoopEvent = {
    dt: 0,
    now: 0,
  };

  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
  }

  handleActivate() {
    this.lastTime = performance.now();
    this.requestFrame();
  }

  handleDeactivate() {}

  handleFrame = () => {
    if (!this.activated) return;

    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.event.now = now;
    this.event.dt = delta;

    this.emit("frame-loop", this.event);
    // rendering, after the frame's data is updated
    this.emit("frame-after", this.event);

    this.requestFrame();
  };

  requestFrame = () => {
    if (!this.activated) return;
    window.requestAnimationFrame(this.handleFrame);
  };
}
