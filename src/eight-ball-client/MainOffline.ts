import { Middleware } from "polymatic";

import { PoolTable } from "../eight-ball/PoolTable";
import { EightBall1P } from "../eight-ball/EightBall1P";
import { Terminal } from "./Terminal";
import { FrameLoop } from "./FrameLoop";
import { CueShot } from "../eight-ball/CueShot";
import { Physics } from "../eight-ball/Physics";
import { StatusOffline } from "./StatusOffline";
import { type ClientBilliardContext } from "./ClientContext";
import { Rack } from "../eight-ball/Rack";

/**
 * Main class for the offline billiard game.
 */
export class MainOffline extends Middleware<ClientBilliardContext> {
  constructor() {
    super();
    this.use(new FrameLoop());
    this.use(new PoolTable());
    this.use(new Rack());
    this.use(new EightBall1P());
    this.use(new Physics());
    this.use(new CueShot());
    this.use(new Terminal());
    this.use(new StatusOffline());
    this.on("activate", this.handleActivate);
  }

  handleActivate = () => {
    this.context.gameStarted = true;
    this.emit("game-start");
  };
}
