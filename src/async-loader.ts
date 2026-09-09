import { Runtime } from "polymatic";

import { LobbyClient } from "./lobby-client/LobbyClient";
import { HudData } from "./eight-ball-client/HudData";
import { runtime } from "./async-signals";

const lobby = new LobbyClient();
// one hud for the whole session: the lobby hands it to every game it starts
const hud = new HudData();
Runtime.activate(lobby, { hud });

runtime.value = { hud, emit: lobby.emit.bind(lobby) };

// for debugging
if (typeof window !== "undefined") {
  window["runtime"] = runtime.value;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    Runtime.deactivate(lobby);
    runtime.value = null;
  });
}
