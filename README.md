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

### Architecture Notes

- Both client-side and server-side are implemented using polymatic middlewares. Some middlewares are only for client-side (i.g. rendering, and room client), some for server-side (i.g. room server), and some can be used in both (i.g. physics simulation). Offline mode uses only browser middlewares, however hen you create a room some middlewares run in the server, and some in the browser.
- Socket.io is used to communicate between client and server. The server is authoritative and clients only send actions to the server.
- Creating and joining rooms is handled by lobby-server and lobby-client, which is independent from game and rooms.
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
