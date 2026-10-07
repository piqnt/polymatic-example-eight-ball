import { Middleware } from "polymatic";

import { Terminal } from "./Terminal";
import { FrameLoop } from "./FrameLoop";
import { PixiManager } from "./PixiManager";
import { CueShot } from "../eight-ball/CueShot";
import { RoomClient } from "./RoomClient";
import { StatusOnline } from "./StatusOnline";
import { type ClientBilliardContext } from "./ClientContext";

/**
 * Main class for the billiard game client.
 */
export class MainClient extends Middleware<ClientBilliardContext> {
  constructor() {
    super();
    this.use(new FrameLoop());
    this.use(new PixiManager());
    this.use(new CueShot());
    this.use(new RoomClient());
    this.use(new StatusOnline());
    this.on("pixi-ready", this.handlePixiReady);
  }

  handlePixiReady = () => {
    this.use(new Terminal());
  };
}
