import { Middleware } from "polymatic";

import { PoolTable } from "../eight-ball/PoolTable";
import { Rack } from "../eight-ball/Rack";
import { EightBall2P } from "../eight-ball/EightBall2P";
import { TurnBased } from "../eight-ball/TurnBased";
import { Physics } from "../eight-ball/Physics";
import { CueShot } from "../eight-ball/CueShot";
import { Computer } from "../eight-ball/Computer";
import { Terminal } from "./Terminal";
import { FrameLoop } from "./FrameLoop";
import { PixiManager } from "./PixiManager";
import { StatusComputer } from "./StatusComputer";
import { type ClientBilliardContext } from "./ClientContext";

/**
 * Main class for the offline game against the computer, with the two-player rules.
 *
 * The lobby hands it two players, this device's `player` and the one named by `computer`, see Computer.
 */
export class MainComputer extends Middleware<ClientBilliardContext> {
  constructor() {
    super();
    this.use(new FrameLoop());
    this.use(new PixiManager());
    this.use(new PoolTable());
    this.use(new Rack());
    // gives the first player, this device's, stripes before TurnBased shuffles the players to pick who breaks
    this.use(new EightBall2P());
    this.use(new TurnBased());
    this.use(new Physics());
    this.use(new CueShot());
    this.use(new Computer());
    this.use(new StatusComputer());
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
