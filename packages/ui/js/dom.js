/* HTML adapter in the browser (PROP_DOM_ADAPTER): finds the reviewable
 * elements of a rendered page – sections by the heading outline, paragraphs,
 * list items, table rows, code blocks, notes and pictures – and gives them
 * the same selectors as the other adapters: html:<kind>:<heading path>#<n>. */
import { sha256 } from "./hash.js";

// never reviewed, with everything inside
const SKIP = "script, style, noscript, template, nav, form, dialog, iframe, button, select, textarea, [hidden], [aria-hidden=true], [data-deciwa-ignore]";
const HEADING = /^H[1-6]$/;
const TEXT_TAGS = new Set(["P", "BLOCKQUOTE", "DD", "DT", "ADDRESS", "FIGCAPTION"]);
const BLOCK_TAGS = new Set(["DIV", "SECTION", "ARTICLE", "MAIN", "ASIDE", "HEADER", "FOOTER", "DETAILS", "LI", "UL", "OL", "DL", "DT", "DD",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "FIGURE", "PRE", "P", "BLOCKQUOTE"]);
// containers: never an element themselves, only what is inside
const CONTAINERS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "UL", "OL", "DL", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "DETAILS"]);

export const normalise = t => String(t ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
// the text as a reader sees it: line breaks between blocks, nothing hidden
const textOf = el => (typeof el.innerText === "string" ? el.innerText : el.textContent);
const short = (t, n = 70) => { t = normalise(t); return t.length <= n ? t : t.slice(0, n - 1) + "…"; };

/** The review root: data-root, else <main>, else the only <article>, else <body>. */
export function findRoot(selector) {
  return (selector && document.querySelector(selector)) || document.querySelector("main")
    || (document.querySelectorAll("article").length === 1 && document.querySelector("article")) || document.body;
}

// page-wide header and footer are site chrome; the header of an article is content
const chrome = el => (el.tagName === "HEADER" || el.tagName === "FOOTER") && !el.parentElement?.closest("article, main, section");

function visible(el) {
  if (el.checkVisibility) return el.checkVisibility();
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// a block that carries text of its own (Astro and friends often use <div> or <span> instead of <p>)
function ownText(el) {
  let t = "";
  for (const n of el.childNodes) {
    if (n.nodeType === 3) t += n.textContent;
    else if (n.nodeType === 1 && !BLOCK_TAGS.has(n.tagName) && !HEADING.test(n.tagName)) t += n.textContent;
  }
  return normalise(t);
}
const hasBlocks = el => [...el.children].some(c => BLOCK_TAGS.has(c.tagName) || HEADING.test(c.tagName));

function pictureOf(el) {
  const tag = el.tagName.toUpperCase();
  if (tag === "FIGURE") return true;
  if (!["IMG", "SVG", "PICTURE", "CANVAS", "VIDEO"].includes(tag)) return false;
  if (el.closest("a, button")) return false;  // logos and icons in links
  const r = el.getBoundingClientRect();
  return r.width >= 48 && r.height >= 48;  // smaller ones are icons
}

function pictureText(el) {
  const img = el.matches("img") ? el : el.querySelector("img");
  const cap = el.querySelector?.("figcaption")?.textContent || "";
  if (img) return `image ${img.currentSrc || img.src} ${img.alt || ""} ${cap}`;
  const svg = el.matches("svg") ? el : el.querySelector("svg");
  return svg ? `svg ${normalise(svg.outerHTML)} ${cap}` : `figure ${normalise(el.textContent)}`;
}
function pictureLabel(el) {
  const img = el.matches("img") ? el : el.querySelector?.("img");
  return short(el.querySelector?.("figcaption")?.textContent || img?.alt || el.getAttribute("aria-label")
    || el.querySelector?.("title")?.textContent || "picture");
}

/**
 * Scan the root and return the elements in page order:
 * {key, selector, kind, label, text, fingerprint, node, parent}.
 * @param {Element} root
 * @param {{ignore?: string, skip?: Element[]}} opts
 */
export async function scan(root, { ignore = "", skip = [] } = {}) {
  const out = [];
  const stack = [];       // open sections: {level, name, element, texts}
  let counters = {};      // per section, as in the Markdown adapter
  const seen = {};        // heading paths, for duplicates (Notes~2)
  const ignoreSel = ignore ? `${SKIP}, ${ignore}` : SKIP;

  const path = () => stack.map(s => s.name).join("/");
  const parent = () => stack.at(-1)?.element.selector ?? null;

  function add(node, kind, text, label) {
    counters[kind] = (counters[kind] || 0) + 1;
    const e = { key: String(out.length + 1), selector: `html:${kind}:${path()}#${counters[kind]}`, kind,
      label: label || short(text), text: normalise(text), node, parent: parent() };
    for (const s of stack) s.texts.push(e.text);  // a section's text is all of its content
    out.push(e);
    return e;
  }

  // a section's text is its title and all of its content, sub-sections included
  const close = () => { const s = stack.pop(); s.element.text = normalise(s.texts.join(" ")); };

  function heading(h) {
    const level = +h.tagName[1];
    while (stack.length && stack.at(-1).level >= level) close();
    const title = normalise(h.textContent) || "?";
    const full = `${path()}/${title}`;
    seen[full] = (seen[full] || 0) + 1;
    const name = (seen[full] === 1 ? title : `${title}~${seen[full]}`).replace(/\//g, "∕");
    for (const s of stack) s.texts.push(title);
    // a <section> or <article> that starts with this heading is the section's box
    const box = h.parentElement;
    const node = box && box !== root && /^(SECTION|ARTICLE)$/.test(box.tagName)
      && box.querySelector("h1, h2, h3, h4, h5, h6") === h ? box : h;
    const e = { key: String(out.length + 1), selector: "", kind: "heading", label: short(title), text: "", node, parent: parent() };
    stack.push({ level, name, element: e, texts: [title] });
    e.selector = `html:heading:${path()}`;
    out.push(e);
    counters = {};
  }

  function walk(el, inItem) {
    for (const child of el.children) {
      if (skip.includes(child) || child.matches(ignoreSel) || chrome(child) || !visible(child)) continue;
      const tag = child.tagName.toUpperCase();
      if (HEADING.test(tag)) { heading(child); continue; }
      if (pictureOf(child)) { add(child, "figure", pictureText(child), pictureLabel(child)); continue; }
      if (tag === "PRE") { add(child, "code", child.textContent); continue; }
      if (tag === "LI") { add(child, "item", textOf(child)); walk(child, true); continue; }
      if (tag === "TR") {
        const cells = [...child.cells];
        if (!child.closest("thead") && !cells.every(c => c.tagName === "TH")) add(child, "row", cells.map(textOf).join(" | "));
        continue;
      }
      if (tag === "ASIDE" || child.getAttribute("role") === "note") {
        add(child, "note", textOf(child));
        if (child.children.length > 1) walk(child, false);  // a note of one paragraph is that paragraph
        continue;
      }
      if (CONTAINERS.has(tag)) { walk(child, inItem); continue; }
      if (inItem) { walk(child, inItem); continue; }  // the item's own text is part of the item
      if (TEXT_TAGS.has(tag) && !hasBlocks(child)) { if (normalise(child.textContent)) add(child, "paragraph", textOf(child)); continue; }
      if (!hasBlocks(child) && ownText(child).split(" ").length >= 3) { add(child, "paragraph", textOf(child)); continue; }
      walk(child, inItem);
    }
  }

  walk(root, false);
  while (stack.length) close();
  await Promise.all(out.map(async e => { e.fingerprint = "sha256:" + await sha256(e.text); }));
  return out;
}
