/* deciwa in monsterbrain – rendered HTML pages. monsterbrain shows HTML files
 * in a sandboxed frame, marks every start tag with its source line and adds
 * this script (with a small bridge to the window). The elements come from the
 * engine's HTML adapter and are matched by line and tag – the same elements
 * as in the source view. Review mode follows the switch in monsterbrain's
 * side panel. */
import { startOverlay } from "../../ui/js/overlay.js";
import { scan, findRoot } from "../../ui/js/dom.js";
import { hostElements } from "../../ui/js/host.js";
import { shadowCss } from "../../ui/js/shadow.js";
import CSS from "../../ui/src/deciwa/ui/static/deciwa-overlay.css";
import MONSTER from "../../ui/src/deciwa/ui/static/deciwa-monster.webp";
import type { Status } from "./types";

const mbx = window.mbx;
const call = (method: string, ...args: unknown[]): Promise<unknown> => mbx.call!("deciwa", method, ...args);
const api = (path: string, body?: unknown): Promise<unknown> => call("frame-api", path, body ?? null);

type Found = { selector: string; kind: string; label: string; line?: number; end?: number; tag?: string; text?: string };
type Scanned = { selector: string; kind: string; label: string; text: string; fingerprint: string; parent: string | null };

async function start(): Promise<void> {
  const status = (await call("status")) as Status;
  if (status.state !== "ready" || !mbx.path) return;
  const path = mbx.path;
  const source = (await call("source", path)) as string;

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
  // the engine's HTML adapter with source lines; a page it cannot read falls back to the DOM scan
  const data = (await api(`/api/elements?source=${encodeURIComponent(source)}`)) as { elements: Found[] };
  let elements: unknown[] = data.elements.length ? hostElements(document.documentElement, data.elements) : [];
  if (!elements.length) {
    elements = await scan(root, { skip: [hostEl] });
    await api("/api/elements", {
      source, title: document.title,
      elements: (elements as Scanned[]).map(({ selector, kind, label, text, fingerprint, parent }) => ({ selector, kind, label, text, fingerprint, parent })),
    });
  }
  const overlay = startOverlay({
    page: { doc: source, source, mode: "host", title: document.title || path },
    elements,
    mount: shadow,
    monster: MONSTER,
    article: () => (root === document.body ? null : root),
    docUrl: () => "#",
    storageKey: "deciwa-monsterbrain",
    exportPages: false,
    api,
    openDoc: ({ doc, source: src }: { doc: string; source?: string }, selector: string | null) => void call("open", src || doc, selector),
    onReview: (on: boolean) => void call("relay", "frame-state", { path, review: on }),
  });
  mbx.on!("deciwa", "changed", () => void overlay.refresh());
  mbx.on!("deciwa", "frame-review", (d) => {
    const { path: p, on } = d as { path: string; on: boolean };
    if (p === path) overlay.setReview(on);
  });
  // tell the window the page is ready; it switches review mode on if it is on in monsterbrain
  void call("relay", "frame-state", { path, review: overlay.review, ready: true });
}

if (mbx?.frame) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
  else void start();
}
