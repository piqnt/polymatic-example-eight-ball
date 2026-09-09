import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { type HudData } from "../eight-ball-client/HudData";

/**
 * What a component is handed: the hud signals to read, and the lobby's own emit
 * to send events back into it. Nothing else of the game is exposed - the shell
 * never holds a middleware.
 */
export interface GameRuntime {
  hud: HudData;
  emit: (type: string, ev?: any) => void;
}

export const GameContext = createContext<GameRuntime | null>(null);

export function useRuntime(): GameRuntime {
  const runtime = useContext(GameContext);
  if (!runtime) throw new Error("useRuntime must be used within a GameContext.Provider");
  return runtime;
}
