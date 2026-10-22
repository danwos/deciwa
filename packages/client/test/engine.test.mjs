// Starts the real engine of this checkout (uv sync) against a temporary folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine, EngineError, initFolder, findEngine } from "../dist/index.js";

const dev = new URL("../../../.venv/bin/deciwa", import.meta.url).pathname;
const skip = existsSync(dev) ? false : "no engine in ../../.venv (run uv sync)";

test("a folder without .deciwa/ is reported", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "deciwa-client-"));
  const e = new Engine({ root: dir, bundled: [dev], restart: false });
  await assert.rejects(e.start(), (err) => err instanceof EngineError && err.code === "no-deciwa");
});

test("start, elements, annotate, summary, events, stop", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "deciwa-client-"));
  writeFileSync(join(dir, "a.md"), "---\nsummary: x\n---\n\n# Title\n\nFirst paragraph.\n\n- one\n- two\n");
  await initFolder(findEngine({ bundled: [dev] }), dir);
  const e = new Engine({ root: dir, bundled: [dev], restart: false });
  const hs = await e.start();
  assert.equal(hs.api, 1);
  const { elements } = await e.elements("a.md");
  assert.deepEqual(elements.map((x) => [x.selector, x.line]), [
    ["md:heading:Title", 5], ["md:paragraph:Title#1", 7], ["md:item:Title#1", 9], ["md:item:Title#2", 10],
  ]);
  const got = [];
  const close = e.events((ev) => got.push(ev));
  await new Promise((r) => setTimeout(r, 300));
  await e.annotate({ source: "a.md", selector: "md:paragraph:Title#1", kind: "feedback", verdict: "approve" });
  const sum = await e.summary();
  assert.equal(sum["a.md"].states.approved, 1);
  for (let i = 0; i < 30 && !got.length; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(got[0]?.type, "changed");
  close();
  await e.stop();
  await assert.rejects(e.page("a.md"), (err) => err.code === "stopped");
});
