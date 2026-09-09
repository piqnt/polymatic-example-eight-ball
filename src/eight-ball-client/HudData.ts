import { type Signal, signal } from "@preact/signals";

export type LobbyMode = "idle" | "offline" | "online";

/**
 * Everything the client's interface shows, as signals.
 *
 * This is the only thing the Preact shell can see of the game. The middleware
 * writes it - StatusOffline and StatusOnline once a frame, RoomClient and
 * LobbyClient as connections come and go - and the shell subscribes by reading
 * `.value` while it renders. Signals only notify on a real change, so a frame
 * that changes no wording re-renders nothing.
 *
 * One instance is made by the lobby and handed to whichever game context is
 * activated, so the status line survives switching between offline and a room.
 */
export class HudData {
  /** which game is running, if any */
  mode: Signal<LobbyMode>;

  /** the room being played in, for the player to read out and share */
  room: Signal<string | null>;

  /** how the game itself is going: whose turn, waiting, game over */
  statusText: Signal<string>;

  /** trouble reaching the room, rather than anything about the game */
  roomError: Signal<string | null>;

  /** the join-a-room dialog, and what is wrong with what has been typed */
  joinOpen: Signal<boolean>;
  joinError: Signal<string | null>;

  constructor() {
    this.mode = signal<LobbyMode>("idle");
    this.room = signal<string | null>(null);
    this.statusText = signal("");
    this.roomError = signal<string | null>(null);
    this.joinOpen = signal(false);
    this.joinError = signal<string | null>(null);
  }
}
