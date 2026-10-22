/* Entry for the web script (PROP_WEB_ONE_LINE): one <script> tag on any
 * page shows deciwa. No build data – the elements come from the DOM, the
 * review stays in this browser, the UI lives in a Shadow DOM. */
import { startOverlay } from "./overlay.js";
import { scan, findRoot } from "./dom.js";
import { shadowCss } from "./shadow.js";
import CSS from "../src/deciwa/ui/static/deciwa-overlay.css";
import MONSTER from "../src/deciwa/ui/static/deciwa-monster.webp";

const script = document.currentScript;
const opt = { ...(script?.dataset || {}) };

// data-activate="param": only with ?deciwa in the address; it then stays on in this tab
function active() {
  if (opt.activate !== "param") return true;
  const q = new URLSearchParams(location.search).get("deciwa");
  try {
    if (q === "off") { sessionStorage.removeItem("deciwa-on"); return false; }
    if (q !== null) { sessionStorage.setItem("deciwa-on", "1"); return true; }
    return sessionStorage.getItem("deciwa-on") === "1";
  } catch (_) { return q !== null && q !== "off"; }
}

// one page, one id: no query, no fragment, index.html and a trailing slash do not count
const docOf = loc => loc.pathname.replace(/\/index\.html?$/, "/").replace(/(.)\/$/, "$1") || "/";

function pageInfo() {
  const doc = docOf(location);
  const meta = document.querySelector('meta[name="deciwa-source"]')?.content?.trim();
  return { doc, source: meta || `web:${location.host}${doc}`, mode: "offline", title: document.title };
}

// the elements of every page seen in this browser (PROP_WEB_INDEX)
const INDEX_KEY = "deciwa-web-index";
const index = (() => { try { return JSON.parse(localStorage.getItem(INDEX_KEY)) || { pages: {} }; } catch (_) { return { pages: {} }; } })();
function remember(page, elements) {
  index.pages[page.doc] = { source: page.source, url: location.host + page.doc, title: page.title,
    elements: elements.map(({ selector, kind, label, text, fingerprint, parent }) => ({ selector, kind, label, text, fingerprint, parent })) };
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch (_) { /* storage full or blocked */ }
}

// inside the shadow root the tokens hang on the host instead of :root and body
const SHADOW_CSS = shadowCss(CSS);
const PAGE_CSS = "body.dwr-on [data-dw-key] { cursor: pointer; } body.dwr-on [data-dw-key] a { cursor: alias; }";

async function start() {
  const hostEl = document.createElement("div");
  hostEl.id = "deciwa";
  hostEl.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;z-index:2147483000;";
  const shadow = hostEl.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${SHADOW_CSS}</style>`;
  const pageStyle = document.createElement("style");
  pageStyle.textContent = PAGE_CSS;
  const attach = () => {
    if (!hostEl.isConnected) document.documentElement.appendChild(hostEl);
    if (!pageStyle.isConnected) document.head.appendChild(pageStyle);
    const theme = document.documentElement.dataset.theme || document.body.dataset.theme;
    if (theme) hostEl.dataset.theme = theme; else delete hostEl.dataset.theme;
  };
  attach();

  let root = findRoot(opt.root);
  const opts = { ignore: opt.ignore || "", skip: [hostEl] };
  let page = pageInfo();
  let elements = await scan(root, opts);
  remember(page, elements);

  const overlay = startOverlay({
    page,
    elements,
    mount: shadow,
    monster: MONSTER,
    article: () => root === document.body ? null : root,
    docUrl: doc => doc,
    storageKey: `deciwa-offline:web:${location.host}`,
    loadData: async () => ({ elements: index, annotations: { files: {} },
      config: { review: { required: [], paths: [] }, mode: "offline" } }),
    exportPages: true,
  });

  // the page changed: scan again (PROP_WEB_RESCAN)
  const signature = () => page.doc + "\n" + elements.map(e => e.selector + e.fingerprint).join("\n");
  let timer = null, last = signature();
  async function rescan() {
    attach();
    const r = findRoot(opt.root);
    if (r !== root) { root = r; watch(); }
    page = pageInfo();
    elements = await scan(root, opts);
    remember(page, elements);
    const now = signature();
    if (now === last) return;
    last = now;
    overlay.update(elements, page);
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(rescan, 600); };
  const mo = new MutationObserver(soon);
  function watch() { mo.disconnect(); mo.observe(root, { childList: true, subtree: true, characterData: true }); }
  watch();
  new MutationObserver(attach).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  for (const ev of ["popstate", "astro:page-load", "turbo:load"]) addEventListener(ev, soon);
  document.addEventListener("astro:page-load", soon);
}

if (!window.__deciwa && active()) {
  window.__deciwa = { version: __VERSION__ };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
