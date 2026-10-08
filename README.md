# 8-Ball Pool - Polymatic Example

Multiplayer 8-Ball pool, implemented using:
- [Polymatic](https://github.com/piqnt/polymatic) framework
- [Socket.io](https://socket.io/)
- [Planck/Box2D](https://github.com/piqnt/planck) physics engine
- [Pixi.js](https://pixijs.com/) rendering.

[Play Online](https://eight-ball.piqnt.com/)

### Gameplay

The gameplay is simplified eight-ball pool:
- Solid (black edge) and stipe (white edge) are assigned to players randomly.
- Two players take turns to play.
- If a player pockets the cue ball, the turn is passed and the cue ball is placed at the original position.
- If a player pockets the 8-ball before all their balls, they lose.
- If a player pockets the 8-ball after all their balls, they win.
- If a player pockets a ball that is assigned to them, they continue to play, otherwise the turn is passed to the other player.

The game starts against the computer: you play stripe, it plays solid, and who breaks is picked at random. Play Computer starts a new one. Practice is a table to yourself, with no turns and no opponent. Create Room starts an online game and shows a room id for the other player to enter with Join Room.

### Architecture Notes

- Both client-side and server-side are implemented using polymatic middlewares. Some middlewares are only for client-side (i.g. rendering, and room client), some for server-side (i.g. room server), and some can be used in both (i.g. physics simulation). Offline games use only browser middlewares, however when you create a room some middlewares run in the server, and some in the browser.
- Socket.io is used to communicate between client and server. The server is authoritative and clients only send actions to the server.
- Creating and joining rooms is handled by lobby-server and lobby-client, which is independent from game and rooms.
- The computer player (`src/eight-ball/Computer.ts`) is a middleware like the others. It reads the balls and emits the same `cue-shot` a player's drag does, so it works with any physics, rendering or network. The lobby names the player it plays with `computer` on the game's context, see `src/eight-ball-client/MainComputer.ts`. For each of its balls and pocket it works out where the cue ball must touch the ball to send it into the pocket's mouth, and keeps clear shots that do not cut too thin or put the cue ball in. Physics steps only 20 times a second, so its cuts are aimed fuller by an amount measured from the simulation.
- Games state is not persisted. If the server restarts, all games are lost.
- The client's interface is Preact (`src/shell`). It never imports a middleware:
  the two sides share `src/eight-ball-client/HudData.ts`, and the signals on it
  are the whole bridge. The status middlewares write them, and the shell calls
  back through `src/shell/actions.ts`, which emits events the lobby listens for.
  One `HudData` is made in `src/async-loader.ts` and handed to every game the
  lobby starts, so the status survives switching between offline and a room.

### Development

Make sure you have node.js/npm installed.

Install dependencies:

```sh
npm install
```

Run locally for development:

```sh
npm run dev
```


In production first build frontend, then start the server:

```sh
npm run build
npm start
```
