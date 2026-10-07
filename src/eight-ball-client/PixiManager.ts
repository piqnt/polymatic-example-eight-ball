import { Application, Container } from "pixi.js";

import { Middleware } from "polymatic";

import { type ClientBilliardContext } from "./ClientContext";
import { type FrameLoopEvent } from "./FrameLoop";

/**
 * Creates and owns the Pixi application, and drives Pixi's ticker from the
 * FrameLoop so there is a single loop.
 */
export class PixiManager extends Middleware<ClientBilliardContext> {
  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
    this.on("frame-after", this.handleFrameAfter);
  }

  handleActivate = async () => {
    const pixi = new Application();
    await pixi.init({
      resizeTo: window,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      // ticker is updated manually in handleFrameAfter, see FrameLoop
      autoStart: false,
    });
    // the game may have been closed while pixi was starting
    if (!this.activated) {
      pixi.destroy();
      return;
    }
    document.body.appendChild(pixi.canvas);

    // scene container, scaled and centered by Terminal to fit the viewbox
    const scene = new Container();
    pixi.stage.addChild(scene);

    this.context.pixi = pixi;
    this.context.scene = scene;
    this.emit("pixi-ready");
  };

  handleDeactivate = () => {
    this.context.pixi?.destroy({ removeView: true }, { children: true });
    this.context.pixi = null;
    this.context.scene = null;
  };

  handleFrameAfter = (ev: FrameLoopEvent) => {
    if (!this.context.pixi) return;
    // runs ticker listeners and then renders the stage
    this.context.pixi.ticker.update(ev.now);
  };
}
