import { Middleware } from "polymatic";
import { io, type Socket } from "socket.io-client";
import { nanoid } from "nanoid";

import { type Auth, type ClientBilliardContext } from "./ClientContext";

/**
 * This runs on client and is responsible for receiving data from server, and passing user actions to server.
 */
export class RoomClient extends Middleware<ClientBilliardContext> {
  io: Socket;
  connectionError: string;

  constructor() {
    super();

    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
    this.on("cue-shot", this.handleCueShot);
  }

  handleActivate = () => {
    this.printRoomStatus();

    // set up auth id and secret
    // id is public and will be shared by other users, secret is private
    const auth = {} as Auth;
    auth.id = localStorage.getItem("auth-id");
    auth.secret = localStorage.getItem("auth-secret");
    if (!auth.id || !auth.secret) {
      auth.id = "player-" + nanoid(8);
      auth.secret = "secret-" + nanoid(8);
      localStorage.setItem("auth-id", auth.id);
      localStorage.setItem("auth-secret", auth.secret);
    }

    this.context.auth = auth;

    const room = this.context.room;
    this.io = io("/room/" + room, {
      auth: auth,
    });

    this.io.on("connect_error", (err) => {
      console.log("connect_error", err.message, err.message === "Invalid namespace");
      if (err.message === "Invalid namespace") {
        this.connectionError = "Room not found!";
      } else {
        this.connectionError = "Connection error: " + err.message;
      }
      this.printRoomStatus();
    });

    this.io.on("connect_failed", (err) => {
      console.log("connect_failed", err);
      this.connectionError = "Connection failed: " + err.message;
    });

    this.io.on("connect", () => {
      console.log("connected to room", room);
      this.connectionError = null;
      this.printRoomStatus();
    });
    this.io.on("room-update", this.handleServerRoomState);
  };

  handleDeactivate = () => {
    this.context.hud.roomError.value = null;
    this.io?.disconnect();
  };

  handleServerRoomState = (data: any) => {
    Object.assign(this.context, data);
    if (Array.isArray(data.players) && this.context.auth) {
      this.context.player = data.players.find((p) => p.id === this.context.auth.id);
    }
  };

  handleCueShot = (data: object) => {
    this.io?.emit("cue-shot", data);
  };

  printRoomStatus = () => {
    this.context.hud.roomError.value = this.connectionError ?? null;
  };
}
