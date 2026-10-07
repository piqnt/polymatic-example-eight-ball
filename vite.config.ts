import preact from "@preact/preset-vite";

export default {
  // relative, so the build works from any path, the game server serves it from the root
  base: "./",
  plugins: [preact()],
};
