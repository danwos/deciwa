/* Element source for host apps (PROP_HOST_ELEMENTS): the host renders the
 * file itself and marks its view – the container carries
 * data-deciwa-source, every block data-line (first source line, 0-based).
 * The engine's adapter names the elements (/api/elements); each one is
 * matched to the block of its kind that starts on its line. Elements of a
 * build index without exact lines (Sphinx) fall back to their text. Blocks
 * without a match are not reviewable.
 *
 * Line views (source code): every line is a block with data-line. With
 * {ranges: true} the lines of each element (line … end) are grouped into one
 * block, nested as the elements are – methods inside their class. */
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
export function hostElements(container, elements, { ranges = false } = {}) {
  if (ranges) return rangeElements(container, elements);
  const byLine = new Map();
  for (const n of container.querySelectorAll("[data-line]")) {
    const line = Number(n.dataset.line);
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push(n);
  }
  const used = new Set();
  // an element that names its tag (HTML adapter) only matches that tag
  const fits = (n, kind, tag) => !used.has(n) && (tag ? n.tagName.toLowerCase() === tag : n.matches(TAGS[kind] || "*"));
  let pool = null;  // every block once, for the text fallback
  const out = [];
  for (const e of elements) {
    let node = e.line ? (byLine.get(e.line - 1) || []).find(n => fits(n, e.kind, e.tag)) : null;
    if (!node && e.text) {
      pool ||= [...container.querySelectorAll(Object.values(TAGS).join(", "))];
      const want = normalise(e.kind === "heading" ? e.label : e.text);
      node = pool.find(n => fits(n, e.kind, e.tag) && normalise(n.textContent) === want) || null;
    }
    if (!node) continue;
    used.add(node);
    out.push({ key: String(out.length + 1), selector: e.selector, kind: e.kind, label: e.label, node });
  }
  return out;
}

const RANGE = "dw-range";

function rangeElements(container, elements) {
  const lines = new Map();
  for (const n of container.querySelectorAll("[data-line]")) lines.set(Number(n.dataset.line), n);
  // outer before inner: by first line, the longer one first
  const list = elements.filter(e => e.line && e.end >= e.line).sort((a, b) => a.line - b.line || b.end - a.end);
  const out = [];
  for (const e of list) {
    const first = lines.get(e.line - 1), last = lines.get(e.end - 1);
    if (!first || !last || first.parentNode !== last.parentNode) continue;
    const box = document.createElement("span");
    box.className = RANGE;
    box.style.display = "block";
    first.parentNode.insertBefore(box, first);
    for (let n = first; n;) {
      const next = n.nextSibling;
      box.appendChild(n);
      if (n === last) break;
      n = next;
    }
    out.push({ key: String(out.length + 1), selector: e.selector, kind: e.kind, label: e.label, node: box });
  }
  return out;
}

/** Undo the grouping of hostElements(…, {ranges: true}). */
export function unwrapRanges(container) {
  for (const box of [...container.querySelectorAll("." + RANGE)].reverse()) box.replaceWith(...box.childNodes);
}
