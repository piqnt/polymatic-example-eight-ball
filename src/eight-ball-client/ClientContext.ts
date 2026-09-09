import { BilliardContext, type Player } from "../eight-ball/BilliardContext";
import { type HudData } from "./HudData";

export interface Auth {
  id: string;
  secret: string;
}

export class ClientBilliardContext extends BilliardContext {
  player?: Player;
  room?: string;
  auth?: Auth;

  /**
   * The bridge to the Preact shell, made by the lobby and shared with every
   * game it starts - see HudData.
   */
  hud: HudData;
}

/**
 * Takes only what it reads rather than the whole client context, so the shared
 * CueShot can call it with a plain BilliardContext.
 */
export const isMyTurn = (context: BilliardContext & { player?: Player }) => {
  if (context.shotInProgress || context.gameOver || !context.gameStarted) return false;
  if (context.turn?.current !== context.player?.turn) return false;
  return true;
};
