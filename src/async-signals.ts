import { signal } from "@preact/signals";

import { type GameRuntime } from "./shell/context";

/**
 * The handle the shell gets on the lobby, set once it is activated. Kept in its
 * own module so the shell can import it without pulling the game, planck and
 * socket.io into the first chunk.
 */
export const runtime = signal<GameRuntime | null>(null);
