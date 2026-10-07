import { type Server, type Socket } from "socket.io";
import { Middleware, Runtime } from "polymatic";

import { randomRoomId } from "../lobby/RoomId";
import { MainServer } from "../eight-ball-server/MainServer";
import { ServerBilliardContext } from "../eight-ball-server/ServerContext";

export const lobby = (io: Server) => {
  Runtime.activate(new LobbyServer(), { io });
};

export class Room {
  id = randomRoomId();
}

interface LobbyContext {
  io: Server;
}

class LobbyServer extends Middleware<LobbyContext> {
  constructor() {
    super();
    this.on("activate", this.handleActivate);
  }

  handleActivate() {
    const io = this.context.io;

    // set up connection and disconnect listeners
    io.on("connection", (socket) => {
      // socket.on("disconnect", (reason) => this.handleSocketDisconnect({ socket, reason }));
      socket.on("create-room", (ack) => this.handleCreateRoomRequest(ack));
      socket.on("check-room", (id, ack) => this.handleCheckRoomRequest(id, ack));
      // this.handleSocketConnect({ socket });
    });
  }

  // handleSocketConnect = ({ socket }: { socket: Socket }) => {};

  // handleSocketDisconnect = ({ socket, reason }: { socket: Socket; reason: DisconnectReason }) => {};

  handleCreateRoomRequest = (ack: (room: { id: string }) => void) => {
    if (typeof ack !== "function") return;
    const room = new Room();
    this.activateRoom(room);
    ack({ id: room.id });
  };

  /** Whether a room is still running: its namespace is removed when it closes, see RoomServer. */
  handleCheckRoomRequest = (id: string, ack: (alive: boolean) => void) => {
    if (typeof ack !== "function") return;
    ack(typeof id === "string" && this.context.io._nsps.has("/room/" + id));
  };

  activateRoom = (room: Room) => {
    // create a socket.io namespace for each room
    const namespace = this.context.io.of("/room/" + room.id);

    // create and activate a server-side game instance
    // create context
    const context = new ServerBilliardContext();
    context.room = room;
    context.io = namespace;
    Runtime.activate(new MainServer(), context);
  };
}
