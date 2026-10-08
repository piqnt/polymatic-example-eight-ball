import { Middleware } from "polymatic";

import { PoolTable } from "../eight-ball/PoolTable";
import { EightBall1P } from "../eight-ball/EightBall1P";
import { Terminal } from "./Terminal";
import { FrameLoop } from "./FrameLoop";
import { PixiManager } from "./PixiManager";
import { CueShot } from "../eight-ball/CueShot";
import { Physics } from "../eight-ball/Physics";
import { StatusOffline } from "./StatusOffline";
import { type ClientBilliardContext } from "./ClientContext";
import { Rack } from "../eight-ball/Rack";

/**
 * Main class for solo practice, offline, with no turns.
 */
export class MainOffline extends Middleware<ClientBilliardContext> {
  constructor() {
    super();
    this.use(new FrameLoop());
    this.use(new PixiManager());
    this.use(new PoolTable());
    this.use(new Rack());
    this.use(new EightBall1P());
    this.use(new Physics());
    this.use(new CueShot());
    this.use(new StatusOffline());
    this.on("activate", this.handleActivate);
    this.on("pixi-ready", this.handlePixiReady);
  }

  handlePixiReady = () => {
    this.use(new Terminal());
  };

  handleActivate = () => {
    this.context.gameStarted = true;
    this.emit("game-start");
  };
}
