// Checks that the committed build in src/deciwa/ui/static/ matches a fresh
// `npm run build`. Version, commit, dirty flag and date are left out: a
// committed build can never carry the commit it is part of.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const here = new URL(".", import.meta.url).pathname;
const files = ["src/deciwa/ui/static/deciwa-overlay.js", "src/deciwa/ui/static/deciwa.js"];

const neutral = text => {
  const version = /deciwa (?:web script|review overlay) (\d+\.\d+\.\d+)/.exec(text)?.[1];
  if (version) text = text.split(version).join("VERSION");
  return text.replace(/commit:\s*"[0-9a-f]*",\s*dirty:\s*(?:!0|!1|true|false),\s*date:\s*"[0-9-]*"/g, 'commit:"",dirty:false,date:""');
};

let stale = [];
for (const f of files) {
  const committed = execSync(`git show HEAD:./${f}`, { cwd: here, maxBuffer: 1 << 26 }).toString();
  const built = readFileSync(new URL(f, import.meta.url), "utf8");
  if (neutral(committed) !== neutral(built)) stale.push(f);
}
if (stale.length) {
  console.error(`The committed build is out of date – run npm run build in packages/ui and commit:\n  ${stale.join("\n  ")}`);
  process.exit(1);
}
console.log("committed build is current");
