/* deciwa in monsterbrain – rendered HTML pages. monsterbrain shows HTML files
 * in a sandboxed frame and adds this script (with a small bridge to the
 * window). The elements come from the DOM scan of the web script, with the
 * file path as source; the engine keeps them like the pages of a website. */
import { startOverlay } from "../../ui/js/overlay.js";
import { scan, findRoot } from "../../ui/js/dom.js";
import { shadowCss } from "../../ui/js/shadow.js";
import CSS from "../../ui/src/deciwa/ui/static/deciwa-overlay.css";
import MONSTER from "../../ui/src/deciwa/ui/static/deciwa-monster.webp";
import type { Status } from "./types";

const mbx = window.mbx;
const call = (method: string, ...args: unknown[]): Promise<unknown> => mbx.call!("deciwa", method, ...args);

async function start(): Promise<void> {
  const status = (await call("status")) as Status;
  if (status.state !== "ready" || !mbx.path) return;
  const source = (await call("source", mbx.path)) as string;

  const hostEl = document.createElement("div");
  hostEl.id = "deciwa";
  hostEl.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;z-index:2147483000;";
  const shadow = hostEl.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${shadowCss(CSS)}</style>`;
  document.documentElement.appendChild(hostEl);
  const pageStyle = document.createElement("style");
  pageStyle.textContent = "body.dwr-on [data-dw-key] { cursor: pointer; }";
  document.head.appendChild(pageStyle);

  const root = findRoot();
  const elements = await scan(root, { skip: [hostEl] });
  type Scanned = { selector: string; kind: string; label: string; text: string; fingerprint: string; parent: string | null };
  await call("frame-api", "/api/elements", {
    source, title: document.title,
    elements: (elements as Scanned[]).map(({ selector, kind, label, text, fingerprint, parent }) => ({ selector, kind, label, text, fingerprint, parent })),
  });
  const overlay = startOverlay({
    page: { doc: source, source, mode: "host", title: document.title || mbx.path },
    elements,
    mount: shadow,
    monster: MONSTER,
    article: () => (root === document.body ? null : root),
    docUrl: () => "#",
    storageKey: "deciwa-monsterbrain",
    exportPages: false,
    api: (path: string, body?: unknown) => call("frame-api", path, body ?? null),
    openDoc: ({ doc, source: src }: { doc: string; source?: string }, selector: string | null) => void call("open", src || doc, selector),
  });
  mbx.on!("deciwa", "changed", () => void overlay.refresh());
}

if (mbx?.frame) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
  else void start();
}
