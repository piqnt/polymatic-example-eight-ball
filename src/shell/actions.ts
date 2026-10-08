import { type GameRuntime } from "./context";

// Everything a control can do, in one file. Components call these; they never
// emit an event or set a signal inline.

/** @action */
export function playComputer({ emit }: GameRuntime) {
  emit("play-computer");
}

/** Solo practice, with no turns and no opponent. */
/** @action */
export function playOffline({ emit }: GameRuntime) {
  emit("play-offline");
}

/** @action */
export function createRoom({ emit }: GameRuntime) {
  emit("create-room");
}

/** @action */
export function openJoin({ hud }: GameRuntime) {
  hud.joinError.value = null;
  hud.joinOpen.value = true;
}

/** @action */
export function closeJoin({ hud }: GameRuntime) {
  hud.joinOpen.value = false;
  hud.joinError.value = null;
}

/** @action */
export function rejoinRoom({ emit }: GameRuntime) {
  emit("rejoin-room");
}

/** @action */
export function declineRejoin({ emit }: GameRuntime) {
  emit("decline-rejoin");
}

/** @action */
export function closeNotice({ hud }: GameRuntime) {
  hud.notice.value = null;
}

/** The lobby is what decides whether this is a room id - see LobbyClient. */
/** @action */
export function joinRoom({ emit }: GameRuntime, id: string) {
  emit("join-room", id);
}
