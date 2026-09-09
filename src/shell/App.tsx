import { GameContext } from "./context";
import { runtime } from "../async-signals";
import { Hud } from "./Hud";

/**
 * The shell. It mounts before the lobby exists (see client.tsx), so the read
 * below is guarded: `runtime` fills in once the lobby has been activated.
 */
export function App() {
  const lobby = runtime.value;

  return <GameContext.Provider value={lobby}>{lobby && <Hud />}</GameContext.Provider>;
}
