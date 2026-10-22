/* deciwa in monsterbrain – window part. Puts the review overlay on rendered
 * Markdown views (the file and the new side of a diff), docks its panel into
 * monsterbrain's side panel and offers review mode as a command. The elements
 * come from the engine's adapter and are matched to the blocks monsterbrain
 * marks with data-line (element source "host", PROP_HOST_ELEMENTS). */
import { startOverlay } from "../../ui/js/overlay.js";
import { hostElements } from "../../ui/js/host.js";
import { shadowCss } from "../../ui/js/shadow.js";
import CSS from "../../ui/src/deciwa/ui/static/deciwa-overlay.css";
import MONSTER from "../../ui/src/deciwa/ui/static/deciwa-monster.webp";
import type { Status, ViewContext } from "./types";

interface Overlay {
  refresh(): Promise<void>;
  destroy(): void;
  dock(el: HTMLElement): void;
  undock(): void;
  toggleReview(): void;
  setReview(on: boolean): void;
  focus(selector: string): void;
  review: boolean;
}

const STYLE = shadowCss(CSS) + `
  .dwr-host-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .dwr-host-head .msg { color: var(--t-muted); font-size: 12px; flex: 1 1 100%; }
  .dwr-host-head .grow { flex: 1; }
  .dwr-host-head .mono { font-size: 11px; color: var(--t-muted); }`;
// in monsterbrain's own document: reviewable blocks show that a click reviews them
const PAGE_CSS = "body.dwr-on [data-dw-key] { cursor: pointer; } body.dwr-on [data-dw-key] a { cursor: alias; }";
const PREFS = "deciwa-panel";  // the overlay keeps review mode here

let status: Status = { state: "starting" };
let current: { path: string; source: string; overlay: Overlay } | null = null;
let section: { path: string | null; slot: HTMLElement; draw: () => void } | null = null;
const pendingFocus = new Map<string, string>();

const ch = window.mbx.register("deciwa", {
  mountView,
  panel: { title: "Review · deciwa", mount: mountPanel },
  commands: [
    { id: "review", title: "review mode on/off", key: "Shift+R", run: toggleReview },
    { id: "verdicts", title: "approve · reject · freeze · delete (review mode)", key: "a r f d" },
    { id: "stars", title: "stars (review mode)", key: "0–5" },
    { id: "comment", title: "write a comment (review mode)", key: "n" },
    { id: "guided", title: "guided review (review mode)", key: "v" },
    { id: "step", title: "next / previous element (review mode)", key: "j k" },
    { id: "parent", title: "the enclosing element (review mode)", key: "Alt click" },
  ],
});

const api = (path: string, body?: unknown): Promise<unknown> => ch.call("api", path, body ?? null);

ch.on("status", (s) => {
  status = s as Status;
  section?.draw();
});
ch.on("changed", () => {
  void current?.overlay.refresh();
  section?.draw();
});
ch.on("focus", (d) => {
  const { path, selector } = d as { path: string; selector: string | null };
  if (!selector) return;
  if (current?.path === path) {
    current.overlay.setReview(true);
    current.overlay.focus(selector);
    section?.draw();
  } else pendingFocus.set(path, selector);
});
void ch.call("status").then((s) => {
  status = s as Status;
  section?.draw();
});

function reviewPref(): boolean {
  try { return JSON.parse(localStorage.getItem(PREFS) || "{}").review === true; } catch { return false; }
}

function toggleReview(): void {
  if (current) current.overlay.toggleReview();
  else {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) || "{}");
      localStorage.setItem(PREFS, JSON.stringify({ ...p, review: !p.review }));
    } catch { /* storage blocked */ }
  }
  section?.draw();
}

function pageStyle(): void {
  if (document.getElementById("deciwa-page-css")) return;
  const s = document.createElement("style");
  s.id = "deciwa-page-css";
  s.textContent = PAGE_CSS;
  document.head.appendChild(s);
}

function mountView(v: ViewContext): (() => void) | void {
  if (v.kind !== "markdown" || v.role === "before") return;  // the old side of a diff stays read only
  let gone = false;
  let overlay: Overlay | null = null;
  let layer: HTMLElement | null = null;
  void (async () => {
    if (status.state !== "ready") {
      status = (await ch.call("status")) as Status;
      if (status.state !== "ready" || gone) return;
    }
    const source = (await ch.call("source", v.path)) as string;
    const data = (await api(`/api/elements?source=${encodeURIComponent(source)}`)) as { title?: string; elements: { selector: string; kind: string; label: string; line?: number; text?: string }[] };
    if (gone) return;
    v.element.dataset.deciwaSource = source;
    pageStyle();
    layer = document.createElement("div");
    layer.className = "deciwa-layer";
    layer.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;z-index:20;";
    v.scroller.appendChild(layer);
    const shadow = layer.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${STYLE}</style>`;
    const focus = pendingFocus.get(v.path);
    pendingFocus.delete(v.path);
    overlay = startOverlay({
      page: { doc: source, source, mode: "host", title: data.title || v.path.split("/").pop() },
      elements: hostElements(v.element, data.elements),
      mount: shadow,
      monster: MONSTER,
      article: () => v.element,
      docUrl: () => "#",
      storageKey: "deciwa-monsterbrain",
      exportPages: false,
      api,
      scroller: v.scroller,
      keys: "review",
      tools: false,
      openDoc: ({ doc, source: src }: { doc: string; source?: string }, selector: string | null) =>
        void ch.call("open", src || doc, selector),
      focus,
    }) as Overlay;
    if (focus) overlay.setReview(true);
    current = { path: v.path, source, overlay };
    section?.draw();
  })().catch((e) => console.error("deciwa:", e));
  return () => {
    gone = true;
    if (overlay) {
      overlay.destroy();
      if (current?.overlay === overlay) current = null;
    }
    layer?.remove();
    delete v.element.dataset.deciwaSource;
    section?.draw();
  };
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function mountPanel(el: HTMLElement, p: { path: string | null; kind?: string }): () => void {
  const shadow = el.attachShadow ? (el.shadowRoot ?? el.attachShadow({ mode: "open" })) : null;
  const root = shadow ?? el;
  root.innerHTML = `<style>${STYLE}</style><div class="dwr"><div class="dwr-host-head"></div><div class="slot"></div></div>`;
  const head = root.querySelector<HTMLElement>(".dwr-host-head")!;
  const slot = root.querySelector<HTMLElement>(".slot")!;
  let docked: Overlay | null = null;

  const draw = (): void => {
    const on = current?.path === p.path ? current.overlay.review : reviewPref();
    if (status.state === "ready" && p.kind === "html") {
      head.innerHTML = `<div class="msg">Review this page with the deciwa button in the page (Shift R inside it).</div>`;
    } else if (status.state === "ready" && p.kind !== "markdown") {
      head.innerHTML = `<div class="msg">deciwa reviews Markdown and HTML files.</div>`;
    } else if (status.state === "ready") {
      head.innerHTML = `<button class="chip${on ? " on" : ""}" data-review title="Review mode (Shift+R)">Review ${on ? "on" : "off"}</button>
        <span class="grow"></span><span class="mono">deciwa ${esc(status.engine ?? "")}</span>`;
    } else if (status.state === "no-deciwa") {
      head.innerHTML = `<div class="msg">This folder is not reviewed with deciwa yet.</div>
        <button class="btn primary" data-init>Set up review</button>`;
    } else if (status.state === "starting") {
      head.innerHTML = `<div class="msg">Starting deciwa …</div>`;
    } else if (status.state === "off") {
      head.innerHTML = "";
    } else {
      head.innerHTML = `<div class="msg">${esc(status.message ?? status.state)}</div>`;
    }
    head.querySelector("[data-review]")?.addEventListener("click", toggleReview);
    head.querySelector("[data-init]")?.addEventListener("click", () => {
      head.innerHTML = `<div class="msg">Setting up …</div>`;
      void ch.call("init").catch((e: Error) => { head.innerHTML = `<div class="msg">${esc(e.message)}</div>`; });
    });
    const want = current && current.path === p.path ? current.overlay : null;
    if (want !== docked) {
      docked?.undock();
      docked = want;
      want?.dock(slot);
    }
    if (!want && status.state === "ready" && p.kind !== "markdown") slot.innerHTML = "";
  };
  section = { path: p.path, slot, draw };
  draw();
  return () => {
    docked?.undock();
    if (section?.slot === slot) section = null;
    root.innerHTML = "";
  };
}
