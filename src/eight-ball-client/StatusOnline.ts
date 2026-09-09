import { Memo, Middleware } from "polymatic";

import { type ClientBilliardContext } from "./ClientContext";

/** Publishes the online game's status line onto the hud - see HudData. */
export class StatusOnline extends Middleware<ClientBilliardContext> {
  memo = Memo.init();

  constructor() {
    super();
    this.on("deactivate", this.handleDeactivate);
    this.on("frame-loop", this.handleFrameLoop);
  }

  handleDeactivate = () => {
    this.memo.clear();
    this.context.hud.statusText.value = "";
  };

  handleFrameLoop = () => {
    const context = this.context;
    const player = context.player;
    if (
      this.memo.update(
        player?.color,
        player?.turn,
        context.turn?.current,
        context.players?.length,
        context.shotInProgress,
        context.room,
      )
    ) {
      const status = [];
      if (context.gameOver) {
        if (context.winner) {
          if (context.winner === context.player.id) {
            status.push("You win");
          } else {
            status.push("You lose");
          }
        } else {
          status.push("Game over");
        }
      } else {
        if (player?.color) {
          status.push("Play " + player?.color);
        }
        if (!context.players || context.players.length < 2) {
          status.push("Waiting for opponent");
        } else if (context.shotInProgress) {
          status.push("Shot in progress");
        } else if (context.turn?.current && player?.turn) {
          status.push(context.turn?.current === player?.turn ? "Your turn" : "Opponent's turn");
        }
      }
      context.hud.statusText.value = status.join(" | ");
    }
  };
}
