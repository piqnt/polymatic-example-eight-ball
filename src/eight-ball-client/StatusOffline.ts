import { Memo, Middleware } from "polymatic";

import { type ClientBilliardContext } from "./ClientContext";

/** Publishes the status line of solo practice onto the hud - see HudData. */
export class StatusOffline extends Middleware<ClientBilliardContext> {
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
    if (this.memo.update(context.shotInProgress, context.gameOver)) {
      const status = [];
      status.push("Practice");
      if (context.shotInProgress) {
        status.push("Shot in progress");
      } else if (context.gameOver) {
        status.push("Game over");
      }
      context.hud.statusText.value = status.join(" | ");
    }
  };
}
