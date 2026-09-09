import { Runtime, Middleware } from "polymatic";
import { io, type Socket } from "socket.io-client";

import { MainClient } from "../eight-ball-client/MainClient";
import { MainOffline } from "../eight-ball-client/MainOffline";
import { HudData } from "../eight-ball-client/HudData";
import { isValidRoomId, normalizeRoomId } from "../lobby/RoomId";

export interface LobbyClientContext {
  hud: HudData;
}

/**
 * Starts and stops games, and keeps the lobby socket.
 *
 * The buttons that drive it are Preact now (see shell/), so this listens for
 * their events rather than binding to elements, and reports back through the
 * shared HudData it hands to every game it starts.
 */
export class LobbyClient extends Middleware<LobbyClientContext> {
  io: Socket;

  room: MainOffline | MainClient;

  constructor() {
    super();

    this.on("activate", this.handleActivate);

    this.on("play-offline", this.handlePlayOffline);
    this.on("create-room", this.handleCreateRoom);
    this.on("join-room", this.handleJoinRoom);
  }

  handleActivate = () => {
    // set up io connection and listeners
    this.io = io();
    this.io.on("connect", () => console.log("connected to lobby"));
    this.io.on("room-ready", this.handleRoomReady);
  };

  /** Whatever was running has to go before the next game takes the table. */
  closeRoom = () => {
    if (this.room) {
      Runtime.deactivate(this.room);
      this.room = null;
    }
    const hud = this.context.hud;
    hud.statusText.value = "";
    hud.roomError.value = null;
    hud.room.value = null;
  };

  handlePlayOffline = () => {
    this.closeRoom();
    this.context.hud.mode.value = "offline";
    Runtime.activate((this.room = new MainOffline()), { hud: this.context.hud });
  };

  handleCreateRoom = () => {
    this.io.emit("create-room");
  };

  handleRoomReady = ({ id }: { id: string }) => {
    this.openRoom(id);
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

  openRoom = (id: string) => {
    this.closeRoom();

    localStorage.setItem("eight-ball-room", id);

    const hud = this.context.hud;
    hud.mode.value = "online";
    hud.room.value = id;

    Runtime.activate((this.room = new MainClient()), { room: id, hud });
  };
}
