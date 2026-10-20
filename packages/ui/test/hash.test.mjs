import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256, _sha256Fallback } from "../js/hash.js";

const hex = b => Buffer.from(b).toString("hex");
const py = t => createHash("sha256").update(t, "utf8").digest("hex");  // what Python's hashlib gives

for (const text of ["", "abc", "Daniel works as advisor since October 2026.", "Ümläute – ✓ 🧠", "x".repeat(1000)]) {
  test(`sha256 matches hashlib: ${text.slice(0, 20)}`, async () => {
    assert.equal(await sha256(text), py(text));
    assert.equal(hex(_sha256Fallback(new TextEncoder().encode(text))), py(text));
  });
}
