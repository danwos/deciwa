// Builds the overlay from js/ (PROP_WEB_BUNDLE):
//   src/deciwa/ui/static/deciwa-overlay.js  for the Sphinx extension (readable)
//   src/deciwa/ui/static/deciwa.js          the web script: one file, CSS and picture inside
import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// MAJOR.MINOR by hand in package.json, BUILD = number of Git commits (danwos tool rules)
const here = new URL(".", import.meta.url).pathname;
const git = args => { try { return execSync(`git ${args}`, { cwd: here, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (_) { return ""; } };
const [major, minor] = JSON.parse(readFileSync(new URL("./package.json", import.meta.url))).version.split(".");
const version = `${major}.${minor}.${git("rev-list --count HEAD") || 0}`;
const commit = git("rev-parse --short HEAD");
const build = { version, commit, dirty: git("status --porcelain -- .") !== ""  /* only this package: open docs edits do not touch the build */, date: new Date().toISOString().slice(0, 10) };
const out = "src/deciwa/ui/static/";
const common = { bundle: true, format: "iife", target: "es2020", legalComments: "none", logLevel: "warning",
  define: { __VERSION__: JSON.stringify(version), __BUILD__: JSON.stringify(build) } };

await esbuild.build({ ...common, entryPoints: ["js/sphinx.js"], outfile: out + "deciwa-overlay.js",
  banner: { js: `/* deciwa review overlay ${version} – built from packages/ui/js/ (npm run build), do not edit */` } });
await esbuild.build({ ...common, entryPoints: ["js/web.js"], outfile: out + "deciwa.js", minify: true,
  loader: { ".css": "text", ".webp": "dataurl" },
  banner: { js: `/* deciwa web script ${version} – https://deciwa.danwos.dev */` } });
console.log(`built deciwa ${version}`);
