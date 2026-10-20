// Builds the overlay from js/ (PROP_WEB_BUNDLE):
//   src/deciwa/ui/static/deciwa-overlay.js  for the Sphinx extension (readable)
//   src/deciwa/ui/static/deciwa.js          the web script: one file, CSS and picture inside
import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const out = "src/deciwa/ui/static/";
const common = { bundle: true, format: "iife", target: "es2020", legalComments: "none", logLevel: "warning",
  define: { __VERSION__: JSON.stringify(version) } };

await esbuild.build({ ...common, entryPoints: ["js/sphinx.js"], outfile: out + "deciwa-overlay.js",
  banner: { js: `/* deciwa review overlay ${version} – built from packages/ui/js/ (npm run build), do not edit */` } });
await esbuild.build({ ...common, entryPoints: ["js/web.js"], outfile: out + "deciwa.js", minify: true,
  loader: { ".css": "text", ".webp": "dataurl" },
  banner: { js: `/* deciwa web script ${version} – https://deciwa.danwos.dev */` } });
console.log(`built deciwa ${version}`);
