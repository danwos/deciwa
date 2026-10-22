/* deciwa in monsterbrain – window part. Puts the review overlay on rendered
 * Markdown views (the file and the new side of a diff), docks its panel into
 * monsterbrain's side panel and offers review mode as a command. The elements
 * come from the engine's adapter and are matched to the blocks monsterbrain
 * marks with data-line (element source "host", PROP_HOST_ELEMENTS). */
import { startOverlay } from "../../ui/js/overlay.js";
import { hostElements, unwrapRanges } from "../../ui/js/host.js";
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
let section: { path: string | null; kind?: string; slot: HTMLElement; draw: () => void } | null = null;
const pendingFocus = new Map<string, string>();
// views mounted while the engine was not ready yet: attached as soon as it is
const waiting = new Set<() => void>();
// rendered HTML pages: review mode of each page, as the page reports it
const frames = new Map<string, boolean>();

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

function setStatus(s: Status): void {
  status = s;
  if (status.state === "ready") for (const attach of [...waiting]) attach();
  section?.draw();
}
ch.on("status", (s) => setStatus(s as Status));
ch.on("frame-state", (d) => {
  const { path, review, ready } = d as { path: string; review: boolean; ready?: boolean };
  frames.set(path, review);
  // a page that just loaded follows monsterbrain's review mode
  if (ready && reviewPref() !== review) void ch.call("relay", "frame-review", { path, on: reviewPref() });
  if (section?.path === path) section.draw();
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
void ch.call("status").then((s) => setStatus(s as Status));

function reviewPref(): boolean {
  try { return JSON.parse(localStorage.getItem(PREFS) || "{}").review === true; } catch { return false; }
}

function setReviewPref(on: boolean): void {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "{}");
    localStorage.setItem(PREFS, JSON.stringify({ ...p, review: on }));
  } catch { /* storage blocked */ }
}

/** Review mode on/off – for the file on screen: a Markdown or code view, or a rendered HTML page. */
function toggleReview(): void {
  const path = section?.path ?? null;
  if (current && (!path || current.path === path)) current.overlay.toggleReview();  // the overlay keeps the setting
  else if (path && frames.has(path)) {
    const on = !frames.get(path);
    setReviewPref(on);
    frames.set(path, on);
    void ch.call("relay", "frame-review", { path, on });
  } else setReviewPref(!reviewPref());
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
  // rendered Markdown and line views (source code); the old side of a diff stays read only
  if (v.role === "before" || (v.mode !== "lines" && v.kind !== "markdown")) return;
  const lines = v.mode === "lines";
  let gone = false;
  let started = false;
  let overlay: Overlay | null = null;
  let layer: HTMLElement | null = null;
  const attach = (): void => {
    if (gone || started || status.state !== "ready") return;
    started = true;
    waiting.delete(attach);
    void open().catch((e) => console.error("deciwa:", e));
  };
  const open = async (): Promise<void> => {
    const source = (await ch.call("source", v.path)) as string;
    const data = (await api(`/api/elements?source=${encodeURIComponent(source)}`)) as { title?: string; elements: { selector: string; kind: string; label: string; line?: number; end?: number; text?: string }[] };
    if (gone || (lines && !data.elements.length)) return;  // a file type without an adapter
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
      elements: hostElements(v.element, data.elements, { ranges: lines }),
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
  };
  waiting.add(attach);
  attach();
  return () => {
    gone = true;
    waiting.delete(attach);
    if (overlay) {
      overlay.destroy();
      if (current?.overlay === overlay) current = null;
    }
    layer?.remove();
    if (lines) unwrapRanges(v.element);
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
    const here = current?.path === p.path;
    const page = !here && p.path !== null && frames.has(p.path);
    const on = here ? current!.overlay.review : page ? frames.get(p.path!)! : reviewPref();
    if (status.state === "ready" && !here && !page && p.kind !== "markdown" && p.kind !== "html") {
      head.innerHTML = `<div class="msg">deciwa reviews Markdown, HTML and Python files – also in the Source view.</div>`;
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
    if (!want && page) slot.innerHTML = `<div class="msg">The page's own deciwa panel: the deciwa button at its bottom right.</div>`;
    else if (!want) slot.innerHTML = "";
  };
  section = { path: p.path, kind: p.kind, slot, draw };
  draw();
  return () => {
    docked?.undock();
    if (section?.slot === slot) section = null;
    root.innerHTML = "";
  };
}
