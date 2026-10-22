// Builds the extension into dist/ – one file per part, the client and the
// overlay bundled in (DEC_PACKAGES: this adapter uses them, holds no logic).
//   dist/main.cjs  monsterbrain main process: engine, decorations, MCP tools
//   dist/view.js   monsterbrain window: overlay on Markdown views, side panel section
//   dist/frame.js  rendered HTML pages: overlay with the DOM scan
import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const here = new URL(".", import.meta.url).pathname;
const git = args => { try { return execSync(`git ${args}`, { cwd: here, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (_) { return ""; } };
const [major, minor] = JSON.parse(readFileSync(new URL("./package.json", import.meta.url))).version.split(".");
const version = `${major}.${minor}.${git("rev-list --count HEAD") || 0}`;
const build = { version, commit: git("rev-parse --short HEAD"), dirty: git("status --porcelain -- .. ") !== "", date: new Date().toISOString().slice(0, 10) };
const alias = { "@danwos/deciwa-client": new URL("../client/src/index.ts", import.meta.url).pathname };
const define = { __VERSION__: JSON.stringify(version), __BUILD__: JSON.stringify(build) };
const web = { bundle: true, format: "iife", target: "es2022", platform: "browser", logLevel: "warning", define,
  loader: { ".css": "text", ".webp": "dataurl" } };

await esbuild.build({ entryPoints: ["src/main.ts"], outfile: "dist/main.cjs", bundle: true, platform: "node",
  format: "cjs", target: "node20", alias, logLevel: "warning", define });
await esbuild.build({ ...web, entryPoints: ["src/view.ts"], outfile: "dist/view.js" });
await esbuild.build({ ...web, entryPoints: ["src/frame.ts"], outfile: "dist/frame.js" });
console.log(`built deciwa-monsterbrain ${version}`);
