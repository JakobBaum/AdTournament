const esbuild = require("esbuild");

const sharedLoader = { ".js": "jsx", ".jsx": "jsx", ".ts": "tsx", ".tsx": "tsx" };

const builds = [
  { entryPoints: ["./src/TournamentDB.js"],      outfile: "./dist/TournamentDB.bundle.js",      format: "iife", globalName: "TournamentDBBundle" },
  { entryPoints: ["./src/Logik.js"],             outfile: "./dist/Logik.bundle.js",             format: "iife", globalName: "LogikBundle" },
  { entryPoints: ["./src/AutodartsApi.js"],      outfile: "./dist/AutodartsApi.bundle.js",      format: "iife", globalName: "AutodartsApiBundle" },
  { entryPoints: ["./src/tournament-entry.jsx"], outfile: "./dist/tournament-app.bundle.js",    format: "iife" },
  { entryPoints: ["./src/content-entry.jsx"],    outfile: "./dist/content.bundle.js",           format: "iife" },
];

Promise.all(
  builds.map((config) => esbuild.build({ bundle: true, loader: sharedLoader, ...config }))
).catch((error) => {
  console.error(error);
  process.exit(1);
});
