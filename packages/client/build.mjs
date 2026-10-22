// dist/index.js (ESM), dist/index.cjs and the type declarations
import * as esbuild from "esbuild";
import { execSync } from "node:child_process";

const common = { entryPoints: ["src/index.ts"], bundle: true, platform: "node", target: "node20", logLevel: "warning" };
await esbuild.build({ ...common, format: "esm", outfile: "dist/index.js" });
await esbuild.build({ ...common, format: "cjs", outfile: "dist/index.cjs" });
execSync("npx tsc", { stdio: "inherit" });
console.log("built @danwos/deciwa-client");
