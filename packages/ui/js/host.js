/* Element source for host apps (PROP_HOST_ELEMENTS): the host renders the
 * file itself and marks its view – the container carries
 * data-deciwa-source, every block data-line (first source line, 0-based).
 * The engine's adapter names the elements (/api/elements); each one is
 * matched to the block of its kind that starts on its line. Elements of a
 * build index without exact lines (Sphinx) fall back to their text. Blocks
 * without a match are not reviewable. */
import { normalise } from "./dom.js";

const TAGS = {
  heading: "h1, h2, h3, h4, h5, h6", paragraph: "p", item: "li", row: "tr", code: "pre",
  figure: "p, figure, img, svg, picture, div", note: "blockquote, aside, div", need: "div, table",
};

/**
 * @param {Element} container  the rendered view, marked by the host
 * @param {{selector: string, kind: string, label: string, line?: number, text?: string}[]} elements
 * @returns {{key: string, selector: string, kind: string, label: string, node: Element}[]}
 */
export function hostElements(container, elements) {
  const byLine = new Map();
  for (const n of container.querySelectorAll("[data-line]")) {
    const line = Number(n.dataset.line);
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push(n);
  }
  const used = new Set();
  const fits = (n, kind) => !used.has(n) && n.matches(TAGS[kind] || "*");
  let pool = null;  // every block once, for the text fallback
  const out = [];
  for (const e of elements) {
    let node = e.line ? (byLine.get(e.line - 1) || []).find(n => fits(n, e.kind)) : null;
    if (!node && e.text) {
      pool ||= [...container.querySelectorAll(Object.values(TAGS).join(", "))];
      const want = normalise(e.kind === "heading" ? e.label : e.text);
      node = pool.find(n => fits(n, e.kind) && normalise(n.textContent) === want) || null;
    }
    if (!node) continue;
    used.add(node);
    out.push({ key: String(out.length + 1), selector: e.selector, kind: e.kind, label: e.label, node });
  }
  return out;
}
