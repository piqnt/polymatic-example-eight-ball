import { Middleware } from "polymatic";

import { Color, Ball } from "./BilliardContext";
import { type ServerBilliardContext } from "../eight-ball-server/MainServer";

/**
 * 8-ball rules and gameplay.
 */
export class EightBall2P extends Middleware<ServerBilliardContext> {
  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("game-start", this.handleInitGame);
    this.on("shot-end", this.handleShotEnd);
  }

  handleActivate() {
    this.emit("init-table");
    this.emit("rack-balls");
  }

  handleInitGame() {
    this.emit("init-cue-ball");
    this.context.players[0].color = "striped";
    this.context.players[1].color = "solid";
  }

  handleShotEnd = (data: { pocketed: Ball[] }) => {
    const player = this.context.players.find((player) => player.turn === this.context.turn.current);
    const color = player?.color;

    const hasCueBall = data.pocketed.some((ball) => ball.color === Color.white);
    const hasEightBall = data.pocketed.some((ball) => ball.color === Color.black);
    const hasOwnBall = data.pocketed.some((ball) => ball.color.endsWith(color));

    if (hasEightBall) {
      const ownBallLeft = this.context.balls.some((ball) => ball.color?.indexOf(color) > -1);
      const playerWin = !ownBallLeft;
      const winner = playerWin ? player : this.context.players.find((p) => p.id !== player.id);
      this.context.gameOver = true;
      this.context.winner = winner?.id;
      this.emit("game-over");
    } else if (hasCueBall) {
      this.emit("pass-turn");
      setTimeout(() => this.emit("init-cue-ball"), 400);
    } else if (hasOwnBall) {
    } else {
      this.emit("pass-turn");
    }
    this.emit("update");
  };
}
