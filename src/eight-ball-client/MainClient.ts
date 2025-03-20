import { Middleware } from "polymatic";

import { Terminal } from "./Terminal";
import { FrameLoop } from "./FrameLoop";
import { CueShot } from "../eight-ball/CueShot";
import { RoomClient, type Auth } from "./RoomClient";
import { BilliardContext } from "../eight-ball/BilliardContext";
import { GameStatus } from "../eight-ball/Status2P";

export class ClientBilliardContext extends BilliardContext {
  room?: string;
  auth?: Auth;
}

/**
 * Main class for the billiard game client.
 */
export class MainClient extends Middleware<ClientBilliardContext> {
  constructor() {
    super();
    this.use(new FrameLoop());
    this.use(new CueShot());
    this.use(new Terminal());
    this.use(new RoomClient());
    this.use(new GameStatus());
  }
}
