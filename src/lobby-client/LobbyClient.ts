import { Runtime, Middleware } from "polymatic";
import { io, type Socket } from "socket.io-client";

import { MainClient } from "../eight-ball-client/MainClient";
import { MainOffline } from "../eight-ball-client/MainOffline";
import { type HudData } from "../eight-ball-client/HudData";
import { isValidRoomId, normalizeRoomId } from "../lobby/RoomId";
import {
  type HeldAuth,
  type LastRoom,
  acquireAuth,
  forgetRoom,
  getLastRoom,
  getTabRoom,
  leaveRoom,
  touchRoom,
} from "./RoomStore";

export interface LobbyClientContext {
  hud: HudData;
}

// a room that has closed is worth mentioning if the player was in it this recently, in ms
const RECENT_ROOM = 10 * 60 * 1000;
// how often the time this browser was last in the room is saved, in ms
const TOUCH_INTERVAL = 30 * 1000;
// how long the offline game waits for the lobby to say whether the last room is running, in ms
const CHECK_WAIT = 3000;

/**
 * Starts and stops games, and keeps the lobby socket.
 *
 * The buttons that drive it are Preact (see shell/), so this listens for their
 * events rather than binding to elements, and reports back through the shared
 * HudData it hands to every game it starts.
 *
 * On load a tab that was in a room, and was reloaded, goes straight back in.
 * If this browser was in a room that is still running, the player is asked
 * whether to rejoin it, or told it has closed if they were in it recently.
 * Otherwise, or once they choose to stay, an offline game starts. The offline
 * game waits for that answer, since building it can keep a slow device too busy
 * to show the question. See RoomStore for what is remembered.
 *
 * The lobby socket is only opened when it is needed, so the game also works as a
 * static page with no server. Requests to the lobby have no timeout: building
 * the game can keep a slow device busy for seconds, which would race a timer
 * with the answer. A server that can not be reached fails to connect instead.
 */
export class LobbyClient extends Middleware<LobbyClientContext> {
  io: Socket | null = null;

  room: MainOffline | MainClient | null = null;
  // the online room, and the login it uses
  roomId: string | null = null;
  held: HeldAuth | null = null;
  touchInterval: ReturnType<typeof setInterval> | null = null;
  // a room was asked for, and the player waits on the lobby
  creating = false;
  // a game was started since the page loaded, offline or online
  started = false;
  startTimeout: ReturnType<typeof setTimeout> | null = null;
  // counts rooms closed, so a room still waiting for its login is not opened after another was
  closed = 0;

  constructor() {
    super();

    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);

    this.on("play-offline", this.handlePlayOffline);
    this.on("create-room", this.handleCreateRoom);
    this.on("join-room", this.handleJoinRoom);
    this.on("rejoin-room", this.handleRejoinRoom);
    this.on("decline-rejoin", this.handleDeclineRejoin);
  }

  handleActivate = () => {
    window.addEventListener("pagehide", this.handlePageHide);

    const room = getTabRoom();
    if (room && isValidRoomId(room)) {
      this.openRoom(room);
      return;
    }

    const last = getLastRoom();
    if (last && isValidRoomId(last.id)) {
      this.checkLastRoom(last);
      this.startTimeout = setTimeout(this.startIfIdle, CHECK_WAIT);
    } else {
      this.startOffline();
    }
  };

  handleDeactivate = () => {
    window.removeEventListener("pagehide", this.handlePageHide);
    clearTimeout(this.startTimeout);
    this.closeRoom();
    this.closeLobby();
  };

  /** The tab may be closing, which is when the time last in the room matters. */
  handlePageHide = () => {
    if (this.roomId) touchRoom(this.roomId);
  };

  /** The lobby socket, opened on first use. */
  lobby(): Socket {
    if (!this.io) {
      this.io = io();
      this.io.on("connect_error", this.handleLobbyError);
    }
    return this.io;
  }

  /** No server, say so if the player is waiting on it, and stop trying: whatever was asked is dropped. */
  handleLobbyError = () => {
    if (this.creating) {
      this.creating = false;
      this.context.hud.roomError.value = "Can not reach the game server";
    }
    this.closeLobby();
    this.startIfIdle();
  };

  /** The offline game, unless the player has started something or is being asked to rejoin. */
  startIfIdle = () => {
    clearTimeout(this.startTimeout);
    if (!this.started && !this.context.hud.rejoinRoom.value) {
      this.startOffline();
    }
  };

  /** Stops it retrying in the background, say when there is no server. */
  closeLobby() {
    this.io?.disconnect();
    this.io = null;
  }

  /** Asks the lobby whether the room this browser was last in is still running. */
  checkLastRoom(last: LastRoom) {
    const hud = this.context.hud;
    this.lobby().emit("check-room", last.id, (alive: boolean) => {
      // the player has gone online meanwhile
      if (this.roomId) return;

      if (alive) {
        hud.rejoinRoom.value = last.id;
      } else {
        forgetRoom(last.id);
        if (Date.now() - last.time < RECENT_ROOM) {
          hud.notice.value = `Room ${last.id} has closed.`;
        }
        // after the notice is on screen
        requestAnimationFrame(() => this.startIfIdle());
      }
    });
  }

  /** Whatever was running has to go before the next game takes the table. */
  closeRoom = () => {
    this.closed++;
    if (this.touchInterval) {
      clearInterval(this.touchInterval);
      this.touchInterval = null;
    }
    if (this.room) {
      Runtime.deactivate(this.room);
      this.room = null;
    }
    this.held?.release();
    this.held = null;
    this.roomId = null;

    const hud = this.context.hud;
    hud.statusText.value = "";
    hud.roomError.value = null;
    hud.room.value = null;
  };

  startOffline() {
    this.creating = false;
    this.started = true;
    this.closeRoom();
    this.context.hud.mode.value = "offline";
    Runtime.activate((this.room = new MainOffline()), { hud: this.context.hud });
  }

  handlePlayOffline = () => {
    leaveRoom();
    this.context.hud.rejoinRoom.value = null;
    this.startOffline();
  };

  handleRejoinRoom = () => {
    const id = this.context.hud.rejoinRoom.value;
    this.context.hud.rejoinRoom.value = null;
    if (id) this.openRoom(id);
  };

  /** Staying offline, the room is not offered again. */
  handleDeclineRejoin = () => {
    this.context.hud.rejoinRoom.value = null;
    leaveRoom();
    this.startIfIdle();
  };

  handleCreateRoom = () => {
    this.creating = true;
    this.context.hud.roomError.value = null;
    this.lobby().emit("create-room", (room: { id: string }) => {
      if (!this.creating) return;
      this.creating = false;
      this.openRoom(room.id);
    });
  };

  /** Takes whatever the player typed, and says so when it is not a room id. */
  handleJoinRoom = (input: string) => {
    const hud = this.context.hud;
    if (!input) return;

    const id = normalizeRoomId(input);

    if (!isValidRoomId(id)) {
      hud.joinError.value = "Room ids look like xxx-xxx-xxx.";
      return;
    }

    hud.joinError.value = null;
    hud.joinOpen.value = false;
    this.openRoom(id);
  };

  openRoom = async (id: string) => {
    this.started = true;
    this.closeRoom();
    const closed = this.closed;

    const hud = this.context.hud;
    hud.rejoinRoom.value = null;
    hud.notice.value = null;
    hud.mode.value = "online";
    hud.room.value = id;
    touchRoom(id);

    const held = await acquireAuth(id);
    if (closed !== this.closed || !this.activated) {
      held.release();
      return;
    }
    this.held = held;
    this.roomId = id;
    this.touchInterval = setInterval(() => touchRoom(id), TOUCH_INTERVAL);

    // the room runs in its own runtime, so it reports back by calling in
    Runtime.activate((this.room = new MainClient()), {
      room: id,
      hud,
      auth: held.auth,
      // the error stays on screen, but nothing about the room is worth keeping
      onRoomNotFound: () => forgetRoom(id),
    });
  };
}
