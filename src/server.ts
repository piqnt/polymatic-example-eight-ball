import express from "express";
import http from "http";
import path from "path";
import ViteExpress from "vite-express";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import { lobby } from "./lobby-server/LobbyServer";

// `npm start` passes --production: serve the built client from dist, rather than running vite
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
if (production) process.env.NODE_ENV = "production";
// vite-express mounts on the base, which vite.config.ts leaves relative for static hosting
ViteExpress.config({ mode: production ? "production" : "development", inlineViteConfig: { base: "/" } });

const PORT = Number(process.env.PORT) || 4801;

// create express app
const expressApp = express();

// create http server
const httpServer = http.createServer(expressApp);

// serves socket.io admin-ui
expressApp.use(
  "/admin/socket.io",
  express.static(path.join(import.meta.dirname, "../node_modules/@socket.io/admin-ui/ui/dist")),
);

// serve client app
ViteExpress.bind(expressApp, httpServer);

// start http server
httpServer.listen(PORT, (...args) => {
  console.log(`Server running on port ${PORT}`);
});

// create socket.io server
const io = new Server(httpServer);

// match-making lobby
lobby(io);

// add socket.io admin ui
instrument(io, {
  auth: false,
  mode: "development",
});
