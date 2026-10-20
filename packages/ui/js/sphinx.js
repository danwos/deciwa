/* Entry for the Sphinx integration: the build tagged every element with
 * dw-el-<n> and wrote the page data into #deciwa-page. */
import { startOverlay } from "./overlay.js";

const pageData = document.getElementById("deciwa-page");
if (pageData) {
  const PAGE = JSON.parse(pageData.textContent);
  const DOC_BASE = location.pathname.endsWith(PAGE.doc + ".html")
    ? location.pathname.slice(0, -(PAGE.doc + ".html").length) : "/";

  const elements = Object.entries(PAGE.keys).map(([key, selector]) => {
    let node;
    if (selector.startsWith("sphinx-needs:")) {
      const anchor = document.getElementById(selector.slice("sphinx-needs:".length));
      node = anchor && (anchor.closest("table.need") || anchor);
    } else {
      node = document.querySelector(`.dw-el-${key}`);
    }
    return { key, selector, kind: PAGE.kinds[key], label: PAGE.labels[key], node };
  });

  async function loadData() {
    if (window.DECIWA_DATA) return window.DECIWA_DATA;  // offline build: data comes as a script, works from file:// too
    const get = async f => { const r = await fetch(DOC_BASE + "_deciwa/" + f, { cache: "no-store" }); if (!r.ok) throw new Error(f); return r.json(); };
    const [elements, annotations, config] = await Promise.all([get("elements.json"),
      get("annotations.json").catch(() => ({ files: {} })),
      get("config.json").catch(() => ({ review: { required: [], paths: [] } }))]);
    return { elements, annotations, config };
  }

  startOverlay({
    page: PAGE,
    elements,
    mount: document.body,
    monster: (document.currentScript?.src || "").replace(/deciwa-overlay\.js.*$/, "deciwa-monster.webp"),
    article: () => document.querySelector("article"),
    docUrl: doc => `${DOC_BASE}${doc}.html`,
    storageKey: "deciwa-offline:" + DOC_BASE,
    loadData,
    exportPages: false,
  });
}
