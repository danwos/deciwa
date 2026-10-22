/* deciwa review overlay: card, panel, bars, guided review.
 * Pure UI: every state and every change comes from the engine – the local
 * server (deciwa serve) or the small offline engine below. The integration
 * (sphinx.js, web.js) hands over the page, its elements and where to draw:
 *   page        {doc, source, mode}
 *   elements    [{key, selector, kind, label, node}]
 *   mount       where the UI is appended (document.body or a shadow root)
 *   monster     URL of the deciwa picture
 *   article()   the content box, for bars and the card (may be null)
 *   docUrl(doc) address of another page
 *   storageKey  localStorage key of the offline review
 *   loadData()  offline data: {elements, annotations, config}
 *   exportPages true: exports carry the elements index (no build has one)
 * A host app (PROP_HOST_ELEMENTS) can also hand over:
 *   api(path, body)   calls the engine itself (no fetch from the page, no polling)
 *   scroller          the element the content scrolls in; the UI is mounted inside it
 *   keys: "review"    keys only while review mode is on; the host has its own for the rest
 *   tools: false      no floating tool pill – the host shows review mode and counts
 *   openDoc({doc, source}, selector)   open another page in the host
 *   focus             selector to open at start
 *   onReview(on)      review mode was switched
 * startOverlay returns {update, refresh, destroy, dock, undock, setReview, toggleReview, focus, review}. */
import { sha256 } from "./hash.js";

export function startOverlay(host) {
  let PAGE = host.page;
  const hostKeys = host.keys === "review";

  // listeners on document and window, removed again by destroy()
  const listeners = [];
  function on(target, type, fn, opts) { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }
  let destroyed = false;

  // where the content scrolls: the window, or a host's scroll box (the UI then lives inside it)
  const scroller = host.scroller || null;
  function frame() {  // the visible content area in viewport coordinates
    if (!scroller) return { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
    return scroller.getBoundingClientRect();
  }
  function origin() {  // add to a viewport point to get its position in the UI layer
    if (!scroller) return { x: scrollX, y: scrollY };
    const r = scroller.getBoundingClientRect();
    return { x: scroller.scrollLeft - r.left - scroller.clientLeft, y: scroller.scrollTop - r.top - scroller.clientTop };
  }
  const scrollView = opts => (scroller || window).scrollBy(opts);
  const contentHeight = () => scroller ? scroller.scrollHeight : document.documentElement.scrollHeight;

  // verdict buttons in the card, in this order; a comment alone is sent as a note
  const ACTS = {
    approve: { label: "Approve", ico: "✓", key: "a", c: "approved", tip: "Confirm the statement – it becomes a decision" },
    reject:  { label: "Reject",  ico: "✗", key: "r", c: "rejected", tip: "The statement is wrong" },
    freeze:  { label: "Approve & freeze", ico: "❄", key: "f", c: "frozen", tip: "Approve and keep exactly as it is – the AI must never change it" },
    delete:  { label: "Delete",  ico: "🗑", key: "d", c: "change",   tip: "Job for the AI: remove this element" },
  };
  // verdicts that can still arrive from the CLI or agents
  const LABELS = { ...Object.fromEntries(Object.entries(ACTS).map(([v, a]) => [v, a.label])),
    note: "Comment", rephrase: "Rephrase", details: "More details" };
  const COLORS = { approve: "approved", reject: "rejected", freeze: "frozen", delete: "change",
    rephrase: "change", details: "change", note: "note" };
  // one line about an annotation for lists: its comment or question, else its verdict; stars are shown apart
  const describe = a => !a ? "" : a.comment || a.question || (a.kind === "feedback" ? LABELS[a.verdict] || a.verdict : "");
  const KEY2ACT = Object.fromEntries(Object.entries(ACTS).map(([v, a]) => [a.key, v]));
  const MONSTER = host.monster;
  const STATE_C = {
    "approved": "approved", "stale": "stale", "frozen": "frozen", "frozen, but changed": "broken",
    "changes requested": "change", "rejected": "rejected", "requested": "requested", "unreviewed": "note",
    "orphaned": "orphaned",
  };
  const cv = name => `var(--${name})`;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // -- elements of this page ----------------------------------------------
  let els = [], bySel = {}, byKey = {};
  function setElements(list) {
    for (const e of els) delete e.node.dataset.dwKey;
    els = list.filter(e => e.node);
    bySel = {};
    for (const e of els) { e.node.dataset.dwKey = e.key; bySel[e.selector] = e; }
    byKey = Object.fromEntries(els.map(e => [e.key, e]));
  }
  setElements(host.elements);
  // events from inside a shadow root reach the document with the host as target
  const inUI = ev => { const path = ev.composedPath(); return path.includes(ui) || path.includes(panel); };

  function elementAt(target, up = 0) {
    const chain = [];
    for (let n = target; n && n !== document.body; n = n.parentElement) {
      const e = n.dataset && n.dataset.dwKey && byKey[n.dataset.dwKey];
      if (!e) continue;
      // a section is picked directly only through its heading
      if (e.kind === "heading" && chain.length === 0 && !n.classList.contains("dw-range")) {
        const h = /^H[1-6]$/.test(n.tagName) ? n : n.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6");
        if (!(h && h.contains(target))) continue;
      }
      chain.push(e);
    }
    return chain[Math.min(up, chain.length - 1)] || null;
  }

  // -- UI scaffolding ------------------------------------------------------
  const ui = document.createElement("div");
  ui.className = "dwr";
  ui.innerHTML = `
    <div class="dwr-box hover"><span class="tag"></span></div>
    <div class="dwr-box focus"></div>
    <div class="dwr-bars"></div>
    <div class="dwr-card"><div class="body"></div></div>
    <aside class="dwr-panel"></aside>
    <div class="dwr-tools">
      <span class="brand" title="deciwa"><img src="${MONSTER}" alt="deciwa"><span class="name">deciwa</span></span><span class="counts"></span><span class="warn"></span>
      <button class="chip" data-t="review" title="Review mode on/off (Shift+R)">Review</button>
      <button class="chip" data-t="panel" title="All annotations of this page (Shift+P)">Panel</button>
    </div>
    <div class="dwr-modal"><div class="in"><div class="tbar"><div class="kind">deciwa file</div><b></b>
      <button class="x" title="Close (Esc)">×</button></div><div class="tools"><button class="btn" data-copy>Copy</button></div><pre></pre></div></div>
    <div class="dwr-toast"></div>`;
  host.mount.appendChild(ui);
  if (host.tools === false) ui.querySelector(".dwr-tools").style.display = "none";
  const $ = s => ui.querySelector(s);
  const hoverBox = $(".dwr-box.hover"), focusBox = $(".dwr-box.focus"), card = $(".dwr-card");
  const panel = $(".dwr-panel"), bars = $(".dwr-bars");

  let view = { elements: {}, orphans: [] };
  // panel, tab and review mode survive page changes
  const PANEL_KEY = "deciwa-panel";
  const panelPrefs = (() => { try { return JSON.parse(localStorage.getItem(PANEL_KEY)) || {}; } catch (_) { return {}; } })();
  let panelTab = ["project", "files", "help"].includes(panelPrefs.tab) ? panelPrefs.tab : "page";
  function savePanelPrefs() {
    try { localStorage.setItem(PANEL_KEY, JSON.stringify({ open: docked ? panelPrefs.open === true : panel.classList.contains("on"), tab: panelTab, review: reviewOn, guided })); } catch (_) {}
  }
  let guided = panelPrefs.guided === true;  // guided review: walk the required elements without a verdict
  let docked = false;  // the panel lives in the host's own side panel
  let online = false, reviewOn = panelPrefs.review === true, hovered = null, current = null, quote = null, version = null;

  function toast(msg) {
    const t = $(".dwr-toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 1800);
  }

  function place(box, node) {
    const r = node.getBoundingClientRect(), o = origin();
    Object.assign(box.style, { display: "block", left: `${r.left + o.x - 4}px`, top: `${r.top + o.y - 3}px`,
      width: `${r.width + 8}px`, height: `${r.height + 6}px` });
  }

  // -- talking to the engine ----------------------------------------------
  // "server": deciwa serve does all the logic. "offline": no server – the
  // review lives in this browser (localStorage) and the small engine below
  // mirrors the rules of the Python engine; "Export" hands the result over.
  let mode = "server";

  async function api(path, body) {
    if (mode === "offline") return Offline.call(path, body);
    if (host.api) return host.api(path, body);
    const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) } : undefined);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "error");
    return data.result;
  }

  // an element counts as decided once it has a verdict – whatever the verdict
  const VERDICTS = ["approve", "reject", "freeze", "delete", "rephrase", "details"];
  const hasVerdict = st => !!st && st.annotations.some(a => a.kind === "feedback" && VERDICTS.includes(a.verdict));
  const Offline = (() => {
    const KEY = host.storageKey;
    let index = { pages: {} }, base = { files: {} }, cfg = { review: { required: [], paths: [] } }, data = null;
    const QUICK = ["rephrase", "details", "delete"], DONE_ = ["approved", "frozen"];
    const norm = t => String(t || "").normalize("NFC").replace(/\s+/g, " ").trim();
    const hash = async t => "sha256:" + await sha256(norm(t));  // the same as model.fingerprint in Python
    const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => "abcdefghijklmnopqrstuvwxyz234567"[b % 32]).join("");
    const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const glob = (pat, str) => new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$").test(str);

    function persist() { data.updated = now(); try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {} }
    async function init() {
      ({ elements: index, annotations: base, config: cfg } = await host.loadData());
      try { data = JSON.parse(localStorage.getItem(KEY)); } catch (_) { data = null; }
      if (!data) data = { files: structuredClone(base.files || {}), review: structuredClone(cfg.review), author: "reviewer" };
      return cfg.mode || "auto";
    }
    const pageOf = src => Object.values(index.pages).find(p => p.source === src) || { elements: [] };
    const anns = src => data.files[src] || [];
    function store(src, list) { if (list.length) data.files[src] = list; else delete data.files[src]; persist(); }

    function resolve(a, els) {
      const sels = a.target.selectors;
      const structural = sels.find(x => x.type === "structural")?.value;
      const quote = sels.find(x => x.type === "TextQuoteSelector");
      let el = els.find(e => e.selector === structural);
      if (!el) {
        const snap = norm(a.target.snapshot);
        const hits = els.filter(e => norm(e.text) === snap || (quote && norm(e.text).includes(snap)));
        if (hits.length !== 1) return [null, false];
        el = hits[0];
      }
      const changed = quote ? !norm(el.text).includes(norm(quote.exact)) : el.fingerprint !== a.target.fingerprint;
      return [el, changed];
    }
    function state(list) {
      const fb = list.filter(a => a.kind === "feedback");
      const freezes = fb.filter(a => a.verdict === "freeze");
      const actions = fb.filter(a => QUICK.includes(a.verdict) && a.status === "open");
      const decisive = fb.filter(a => a.verdict === "approve" || (a.verdict === "reject" && a.status === "open"));
      const requests = list.filter(a => a.kind === "request" && a.status === "open");
      const ratings = list.filter(a => a.kind === "rating");
      let st = "unreviewed";
      if (freezes.length) st = freezes.at(-1).changed ? "frozen, but changed" : "frozen";
      else if (actions.length) st = "changes requested";
      else if (decisive.length) st = decisive.at(-1).verdict === "reject" ? "rejected" : decisive.at(-1).changed ? "stale" : "approved";
      else if (requests.length) st = "requested";
      return { state: st, requested: !!requests.length, stars: ratings.length ? ratings.at(-1).stars : null, annotations: list };
    }
    function isRequired(src, e) {
      const r = data.review;
      if (r.paths.length && !r.paths.some(p => glob(p, src))) return false;
      return r.required.some(x => x === "all" || x === e.kind || (x.includes(":") && glob(x, e.selector)));
    }
    function view(src) {
      const els = pageOf(src).elements, per = {}, orphans = [];
      for (const a of anns(src)) {
        const [el, changed] = resolve(a, els);
        const item = { ...a, changed };
        if (!el) { orphans.push({ ...item, state: "orphaned" }); continue; }
        item.element = el.selector; item.current = el.text;
        (per[el.selector] ||= []).push(item);
      }
      const elements = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, state(v)]));
      return { source: src, elements, orphans, required: els.filter(e => isRequired(src, e)).map(e => e.selector), rules: data.review };
    }
    function replacedBy(n, o, sel) {
      if (o.author !== n.author || o.kind !== n.kind || o.target.fingerprint !== n.target.fingerprint) return false;
      if (!o.target.selectors.some(x => x.type === "structural" && x.value === sel)) return false;
      const q = a => JSON.stringify(a.target.selectors.filter(x => x.type === "TextQuoteSelector"));
      if (q(o) !== q(n)) return false;
      if (n.kind === "rating") return true;
      return n.kind === "feedback" && n.verdict !== "note" && o.verdict !== "note";
    }
    async function add({ source, selector, kind, quote, ...f }) {
      const el = pageOf(source).elements.find(e => e.selector === selector);
      if (!el) throw new Error("element not found – reload the page");
      if (kind === "feedback" && f.verdict === "note" && !f.comment) throw new Error("a note needs a comment");
      const selectors = [{ type: "structural", value: selector }];
      let snapshot = el.text, fp = el.fingerprint;
      if (quote) { selectors.push({ type: "TextQuoteSelector", ...quote }); snapshot = quote.exact; fp = await hash(quote.exact); }
      const open = kind === "request" || (kind === "feedback" && [...QUICK, "reject", "note"].includes(f.verdict));
      const ann = { id: newId(), kind, target: { selectors, fingerprint: fp, snapshot }, author: data.author,
        created: now(), status: open ? "open" : "resolved", replies: [] };
      for (const k of ["verdict", "stars", "comment", "question", "to"]) if (f[k] !== undefined && f[k] !== null && f[k] !== "") ann[k] = f[k];
      const all = anns(source);
      const keep = all.filter(o => !replacedBy(ann, o, selector));
      for (const o of all.filter(o => !keep.includes(o)))
        if (o.comment && o.comment !== ann.comment) keep.push({ ...o, id: newId(), verdict: "note", status: "resolved" });
      keep.push(ann);
      store(source, keep);
      return ann;
    }
    function find(id) {
      for (const [src, list] of Object.entries(data.files)) { const a = list.find(x => x.id === id); if (a) return [src, list, a]; }
      throw new Error("annotation not found");
    }
    function project() {
      let total = 0, done = 0, decided = 0, rated = 0;
      const pages = Object.keys(index.pages).sort((a, b) => (a !== "index") - (b !== "index") || a.localeCompare(b)).map(doc => {
        const pg = index.pages[doc], v = view(pg.source), req = new Set(v.required);
        const items = pg.elements.filter(e => v.elements[e.selector] || req.has(e.selector)).map(e => {
          const st = v.elements[e.selector], last = st ? st.annotations.at(-1) : {};
          return { selector: e.selector, label: e.label, kind: e.kind, state: st ? st.state : "unreviewed", required: req.has(e.selector),
            decided: hasVerdict(st), rated: !!st && st.stars !== null,
            stars: st ? st.stars : null, requested: st ? st.requested : false, last: describe(st && last) };
        });
        const d = items.filter(i => i.required && DONE_.includes(i.state)).length;
        const dc = items.filter(i => i.required && i.decided).length, rt = items.filter(i => i.required && i.rated).length;
        total += req.size; done += d; decided += dc; rated += rt;
        return { doc, source: pg.source, title: pg.title || doc, required: req.size, done: d, decided: dc, rated: rt, items, orphans: v.orphans.length };
      });
      return { required: total, done, decided, rated, pages, rules: data.review };
    }
    function call(path, body) {
      const [p, q] = path.split("?");
      const params = Object.fromEntries(new URLSearchParams(q || ""));
      if (p === "/api/page") return view(params.source);
      if (p === "/api/project") return project();
      if (p === "/api/annotate") return add(body);
      if (p === "/api/rules") { data.review.required = [...body.required, ...data.review.required.filter(r => r.includes(":"))]; persist(); return data.review; }
      const [src, list, a] = find(body.id);
      if (p === "/api/delete") { store(src, list.filter(x => x.id !== body.id)); return null; }
      if (p === "/api/reply") {
        if (body.text || body.verdict) a.replies.push({ author: data.author, created: now(), ...(body.text ? { text: body.text } : {}), ...(body.verdict ? { verdict: body.verdict } : {}) });
        if (body.status) a.status = body.status;
        store(src, list); return a;
      }
      throw new Error("unknown action");
    }
    const exportData = () => ({ deciwa: "0.1", exported: now(), updated: data.updated || null, origin: "browser",
      files: structuredClone(data.files), ...(host.exportPages ? { pages: structuredClone(index.pages) } : {}) });
    function importData(file) {  // replaces, never merges
      if (!file || typeof file.files !== "object") throw new Error("not a deciwa export");
      data = { files: structuredClone(file.files), review: data.review, author: data.author };
      persist();
      return { annotations: count(), sources: Object.keys(data.files).length };
    }
    function reset() { data = { files: structuredClone(base.files || {}), review: structuredClone(cfg.review), author: data.author }; persist(); }
    const count = () => Object.values(data.files).reduce((n, l) => n + l.length, 0);
    const updated = () => data.updated || null;
    return { init, call, exportData, importData, reset, count, updated };
  })();

  async function refresh() {
    if (PAGE.mode === "offline" && mode === "server") {  // static site: do not even ask for a server
      try { await Offline.init(); mode = "offline"; } catch (_) { online = false; }
    }
    try {
      view = await api(`/api/page?source=${encodeURIComponent(PAGE.source)}`);
      online = true;
    } catch (e) {
      if (mode === "server") {
        try {
          const wanted = await Offline.init();
          if (wanted === "server") throw new Error("server only");
          mode = "offline";
          view = await api(`/api/page?source=${encodeURIComponent(PAGE.source)}`);
          online = true;
        } catch (_) { online = false; }
      } else online = false;
    }
    $(".warn").textContent = online ? "" : "read-only";
    drawBars(); drawCounts();
    if (panel.classList.contains("on")) drawPanel();
    if (current) openCard(current, false);
  }

  async function save(kind, fields) {
    if (!online) return toast("read-only");
    try {
      await api("/api/annotate", { source: PAGE.source, selector: current.selector, kind, ...fields, ...(quote ? { quote } : {}) });
      toast(kind === "rating" ? `${fields.stars} ★ saved` : `${LABELS[fields.verdict] || kind} saved`);
      quote = null;
      const ta = card.querySelector("textarea"); if (ta) ta.value = "";
      await refresh();
      if (guided && kind === "feedback" && fields.verdict !== "note") guideStep(1);
    } catch (err) { toast(err.message); }
  }

  // -- guided review ---------------------------------------------------------
  const pending = () => els.filter(e => (view.required || []).includes(e.selector) && !hasVerdict(view.elements[e.selector]));
  async function guideStep(dir) {
    const list = pending();
    const all = els.filter(e => (view.required || []).includes(e.selector));
    const from = current ? all.indexOf(current) : -1;
    // next/previous open element after the current one in page order
    const ordered = dir > 0 ? all.slice(from + 1).concat(all.slice(0, from + 1)) : all.slice(0, Math.max(from, 0)).reverse().concat(all.slice(from).reverse());
    let next = ordered.find(e => list.includes(e) && e !== current);
    if (next && dir > 0 && all.indexOf(next) <= from) next = null;  // wrapped: look at the next pages first
    if (next) return goTo(null, next.selector);
    if (dir < 0) return toast("No open element above");
    try {
      const pr = await api("/api/project");
      const docs = pr.pages.map(p => p.doc), here = docs.indexOf(PAGE.doc);
      for (const pg of pr.pages.slice(here + 1).concat(pr.pages.slice(0, here + 1))) {
        const item = pg.items.find(i => i.required && !i.decided);
        if (!item) continue;
        if (pg.doc === PAGE.doc) return goTo(null, item.selector);
        return goTo(pg.doc, item.selector, pg.source);
      }
    } catch (_) {}
    toast("Done – every required element has a verdict");
    setGuided(false);
  }
  function setGuided(on) {
    guided = on;
    if (on && !reviewOn) toggleReview();
    savePanelPrefs();
    if (panel.classList.contains("on")) drawPanel();
    if (on) {
      if (current && pending().includes(current)) openCard(current, false);
      else { closeCard(); guideStep(1); }  // start with the first open element of the page
    } else if (current) openCard(current, false);
  }

  // -- bars, counts, panel ---------------------------------------------------
  const KIND_LABELS = { need: "Sphinx-Needs objects", heading: "Headings (sections)", paragraph: "Paragraphs",
    item: "List items", row: "Table rows", code: "Code blocks", note: "Notes, admonitions", figure: "Figures",
    class: "Classes (source code)", function: "Functions, methods", statement: "Statements outside functions",
    all: "Everything" };
  const DONE = ["approved", "frozen"];
  const isRequired = sel => (view.required || []).includes(sel);
  const stateName = sel => view.elements[sel]?.state || "unreviewed";
  // "to review" = required and still without a verdict
  const openRequired = () => (view.required || []).filter(sel => bySel[sel] && !hasVerdict(view.elements[sel]));

  function drawBars() {
    bars.innerHTML = "";
    const article = host.article() || document.body;
    const o = origin();
    const left = article.getBoundingClientRect().left + o.x - 14;
    const sels = new Set([...Object.keys(view.elements), ...(view.required || [])]);
    for (const sel of sels) {
      const e = bySel[sel]; if (!e) continue;
      const st = view.elements[sel];
      const r = e.node.getBoundingClientRect();
      const b = document.createElement("div");
      b.className = "dwr-bar" + (st?.requested ? " req" : "") + (st ? "" : " todo");
      Object.assign(b.style, { left: `${left}px`, top: `${r.top + o.y}px`, height: `${Math.max(r.height, 14)}px` });
      if (st) b.style.background = cv(STATE_C[st.state]);
      b.title = st ? `${st.state}${st.stars != null ? ` · ${st.stars} ★` : ""}${st.requested ? " · question open" : ""}`
                   : "must be approved – not reviewed yet";
      b.onclick = () => openCard(e);
      bars.appendChild(b);
    }
  }

  function drawCounts() {
    const c = {};
    for (const st of Object.values(view.elements)) c[st.state] = (c[st.state] || 0) + 1;
    if (view.orphans.length) c.orphaned = view.orphans.length;
    const open = Object.values(view.elements).filter(s => s.requested).length;
    const req = (view.required || []).filter(sel => bySel[sel]);
    const done = req.length - openRequired().length;
    $(".counts").innerHTML =
      (req.length ? `<span title="required elements with a verdict"><i class="todo"></i>${done}/${req.length}</span>` : "") +
      Object.entries(c).map(([s, n]) => `<span title="${esc(s)}"><i style="--c:${cv(STATE_C[s])}"></i>${n}</span>`).join("") +
      (open ? `<span title="open questions"><i style="--c:var(--requested)"></i>${open} ?</span>` : "");
  }

  function item(sel, state, text) {
    return `<div class="item${isRequired(sel) ? " required" : ""}" data-sel="${esc(sel)}" style="--c:${cv(STATE_C[state])}">
      <div class="t"><b>${esc(bySel[sel]?.label || sel)}</b><span>${esc(state)}${view.elements[sel]?.stars != null ? " · " + view.elements[sel].stars + "★" : ""}</span></div>
      ${text ? `<div class="c">${esc(text)}</div>` : ""}</div>`;
  }

  const ORDER = ["frozen, but changed", "changes requested", "rejected", "requested", "stale", "unreviewed", "approved", "frozen"];

  function rulesBox(rules) {
    const patterns = rules.required.filter(r => r.includes(":"));
    return `<details class="rules"><summary>Must be approved: ${esc(rules.required.join(", ") || "nothing")}</summary>
        <div class="kinds">${Object.entries(KIND_LABELS).map(([k, l]) =>
          `<label><input type="checkbox" value="${k}" ${rules.required.includes(k) ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div>
        ${patterns.length ? `<div class="hint">Patterns: ${esc(patterns.join(", "))}</div>` : ""}
        ${rules.paths.length ? `<div class="hint">Only in: ${esc(rules.paths.join(", "))}</div>` : ""}
      </details>`;
  }
  const coverage = (decided, rated, total) => {
    if (!total) return `<div class="cov">Nothing required</div>`;
    const p = n => Math.round(100 * n / total);
    return `<div class="cov">
      <div class="legend"><span><i class="v"></i>Verdict <b>${p(decided)} %</b> · ${decided}/${total}</span>
        <span><i class="q"></i>Quality <b>${p(rated)} %</b> · ${rated}/${total}</span></div>
      <div class="track two"><i class="v" style="width:${p(decided)}%"></i><i class="q" style="width:${p(rated)}%"></i></div></div>`;
  };

  const guideButton = () => `<div class="row guided"><button class="btn${guided ? "" : " primary"}" data-guided>${guided ? "■ Stop guided" : "▶ Guided review"}</button>
    <span class="keys"><kbd>v</kbd> ${guided ? "stop" : "start"} · <kbd>j</kbd> next · <kbd>k</kbd> previous</span></div>`;

  function pageBody() {
    const req = (view.required || []).filter(sel => bySel[sel]);
    const todo = openRequired();
    const rated = req.filter(sel => view.elements[sel]?.stars != null).length;
    let html = coverage(req.length - todo.length, rated, req.length) + guideButton() + rulesBox(view.rules || { required: [], paths: [] });
    if (todo.length) {
      html += `<h4>To review · ${todo.length}</h4>` + todo.map(sel => {
        const last = view.elements[sel]?.annotations.at(-1);
        return item(sel, stateName(sel), describe(last));
      }).join("");
    }
    const groups = {};
    for (const [sel, st] of Object.entries(view.elements)) {
      if (todo.includes(sel)) continue;
      (groups[st.state] ||= []).push([sel, st]);
    }
    for (const s of ORDER) {
      if (!groups[s]) continue;
      html += `<h4>${esc(s)} · ${groups[s].length}</h4>` + groups[s].map(([sel, st]) => {
        const last = st.annotations.at(-1);
        return item(sel, s, describe(last));
      }).join("");
    }
    if (!todo.length && !Object.keys(view.elements).length && !view.orphans.length)
      html += `<div class="empty">Nothing on this page yet.</div>`;
    if (view.orphans.length) {
      html += `<h4>orphaned · ${view.orphans.length}</h4>`;
      for (const o of view.orphans) html += `<div class="item" style="--c:var(--orphaned)"><div class="t"><b>${esc(o.target.snapshot.slice(0, 80))}</b></div>
        <div class="c">${esc(o.target.selectors[0].value)}</div></div>`;
    }
    return html;
  }

  async function projectBody() {
    let data;
    try { data = await api("/api/project"); } catch (_) { return `<div class="empty">read-only – start “deciwa serve”</div>`; }
    let html = coverage(data.decided, data.rated, data.required) + guideButton() + rulesBox(data.rules);
    const quiet = [];
    for (const pg of data.pages) {
      if (!pg.items.length) { quiet.push(pg); continue; }
      const open = pg.items.filter(i => i.required && !i.decided).length;
      const items = pg.items.slice().sort((x, y) =>
        (y.required && !y.decided) - (x.required && !x.decided) || ORDER.indexOf(x.state) - ORDER.indexOf(y.state));
      html += `<details class="pg"${pg.doc === PAGE.doc || open ? " open" : ""}>
        <summary><b>${esc(pg.title)}</b><span>${pg.required ? `${pg.decided}/${pg.required} · ${pg.rated}★` : ""}${pg.orphans ? ` · ${pg.orphans} orphaned` : ""}</span></summary>
        ${items.map(i => `<div class="item${i.required ? " required" : ""}" data-doc="${esc(pg.doc)}" data-src="${esc(pg.source)}" data-sel="${esc(i.selector)}" style="--c:${cv(STATE_C[i.state])}">
          <div class="t"><b>${esc(i.label)}</b><span>${esc(i.state)}${i.stars != null ? " · " + i.stars + "★" : ""}${i.requested ? " · ?" : ""}</span></div>
          ${i.last ? `<div class="c">${esc(LABELS[i.last] || i.last)}</div>` : ""}</div>`).join("")}
      </details>`;
    }
    if (quiet.length) html += `<h4>No feedback · ${quiet.length} pages</h4><div class="quiet">${quiet.map(pg =>
      `<a href="${host.openDoc ? "#" : esc(host.docUrl(pg.doc))}" data-doc="${esc(pg.doc)}" data-src="${esc(pg.source)}">${esc(pg.title)}</a>`).join("")}</div>`;
    return html;
  }

  function goTo(doc, sel, source) {
    if (doc && doc !== PAGE.doc) {
      if (host.openDoc) return host.openDoc({ doc, source }, sel);
      location.href = `${host.docUrl(doc)}#deciwa=${encodeURIComponent(sel)}`;
      return;
    }
    const e = bySel[sel]; if (!e) return;
    // open at once and scroll only once, so that element and card are both in view
    if (reviewOn) openCard(e, true, false);
    else {
      place(focusBox, e.node);  // just show where it is
      setTimeout(() => { if (!current) focusBox.style.display = "none"; }, 1600);
    }
    showInView(e.node, reviewOn ? card : null);
  }

  function showInView(node, extra) {
    const r = node.getBoundingClientRect(), f = frame();
    let top = r.top - f.top, bottom = r.bottom - f.top;
    if (extra) { const c = extra.getBoundingClientRect(); top = Math.min(top, c.top - f.top); bottom = Math.max(bottom, c.bottom - f.top); }
    const room = f.height - (host.tools === false ? 16 : 90);  // keep clear of the deciwa button
    if (top >= 8 && bottom <= room) return;  // already visible – no scrolling at all
    const h = bottom - top;
    const delta = h <= room - 8 ? top - (room - h) / 2 : top - 16;  // centre the pair, or start at its top
    scrollView({ top: delta, behavior: Math.abs(delta) > f.height * 2 ? "instant" : "smooth" });
  }

  // -- import / export --------------------------------------------------------
  let picked = null;  // {name, data} of a file chosen for import
  const fmt = t => t ? t.replace("T", " ").replace("Z", " UTC") : "–";
  function fileInfo(d) {
    const files = Object.entries(d.files || {});
    const anns = files.flatMap(([, l]) => l);
    const authors = [...new Set(anns.map(a => a.author))];
    return `<table class="info">
      <tr><td>Exported</td><td>${esc(fmt(d.exported))}</td></tr>
      <tr><td>Last change</td><td>${esc(fmt(d.updated))}</td></tr>
      <tr><td>From</td><td>${esc(d.origin === "server" ? "deciwa serve" : d.origin === "browser" ? "a browser (offline)" : "–")}</td></tr>
      <tr><td>Entries</td><td>${anns.length} in ${files.length} sources</td></tr>
      <tr><td>Authors</td><td>${esc(authors.join(", ") || "–")}</td></tr></table>
      ${files.length ? `<div class="srcs">${files.map(([src, l]) => `<div><span class="mono">${esc(src)}</span><b>${l.length}</b></div>`).join("")}</div>` : ""}`;
  }
  function filesBody() {
    const here = mode === "offline"
      ? `<div class="hint">Offline – ${Offline.count()} entries are kept in this browser (last change ${esc(fmt(Offline.updated()))}).</div>`
      : `<div class="synced">✓ Everything is saved on the server – nothing to sync.</div>`;
    let html = `<h4>Export</h4>${here}
      <div class="row"><button class="btn primary" data-files="export">Export deciwa file</button><button class="btn" data-files="show">Show</button>
      ${mode === "offline" ? `<button class="btn" data-files="reset">Reset</button>` : ""}</div>
      <h4>Import</h4>
      <label class="drop"><input type="file" accept=".json,application/json" data-files="pick"><span>${picked ? esc(picked.name) : "Choose a deciwa file …"}</span></label>`;
    if (picked) {
      const mine = mode === "offline" ? Offline.updated() : null;
      const older = mine && (!picked.data.updated || picked.data.updated < mine);
      html += fileInfo(picked.data) + (older ? `<div class="warnbox">This file is older than the data in this browser (${esc(fmt(mine))}).</div>` : "") +
        `<div class="row"><button class="btn fill" style="--c:var(--change)" data-files="load">Replace ${mode === "offline" ? "browser" : "server"} data</button>
         <button class="btn" data-files="cancel">Cancel</button></div>
         <div class="hint">No merge – the file replaces all review data.</div>`;
    }
    return html;
  }
  const exportData = async () => mode === "offline" ? Offline.exportData() : api("/api/export");
  async function showFile() {
    try {
      const data = await exportData();
      const m = $(".dwr-modal");
      m.querySelector(".tbar b").textContent = `${Object.values(data.files).reduce((n, l) => n + l.length, 0)} entries · ${Object.keys(data.files).length} sources`;
      m.querySelector("pre").textContent = JSON.stringify(data, null, 2);
      m.classList.add("on");
    } catch (err) { toast(err.message); }
  }
  const closeModal = () => $(".dwr-modal").classList.remove("on");
  $(".dwr-modal .x").onclick = closeModal;
  $(".dwr-modal").onclick = ev => { if (ev.target === ev.currentTarget) closeModal(); };
  $(".dwr-modal [data-copy]").onclick = async () => {
    try { await navigator.clipboard.writeText($(".dwr-modal pre").textContent); toast("Copied"); } catch (_) { toast("Copy not allowed here"); }
  };
  async function download() {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `deciwa-review-${(data.exported || "").replace(/[:]/g, "").slice(0, 15)}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) { toast(err.message); }
  }
  function wireFiles() {
    panel.querySelectorAll("[data-files]").forEach(el => {
      const what = el.dataset.files;
      if (what === "pick") el.onchange = async () => {
        const f = el.files[0]; if (!f) return;
        try { picked = { name: f.name, data: JSON.parse(await f.text()) }; if (!picked.data.files) throw new Error(); }
        catch (_) { picked = null; toast("Not a deciwa file"); }
        drawPanel();
      };
      else el.onclick = async () => {
        if (what === "export") return download();
        if (what === "show") return showFile();
        if (what === "cancel") { picked = null; return drawPanel(); }
        if (what === "reset") {
          if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Reset – sure?"; return; }
          Offline.reset(); toast("Offline review reset"); return refresh();
        }
        if (what === "load") {
          if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Replace – sure?"; return; }
          try {
            const r = mode === "offline" ? Offline.importData(picked.data) : await api("/api/import", { data: picked.data });
            toast(`Loaded ${r.annotations} entries`); picked = null; refresh();
          } catch (err) { toast(err.message); drawPanel(); }
        }
      };
    });
  }

  // -- help -------------------------------------------------------------------
  // e.g. "0.2.57 · 666f99a · 2026-10-22", "+" after the commit when built with uncommitted changes
  const buildLine = () => [__BUILD__.version, __BUILD__.commit && __BUILD__.commit + (__BUILD__.dirty ? "+" : ""), __BUILD__.date].filter(Boolean).join(" · ");
  const HELP_KEYS = [["Shift R", "review mode on/off"], ["Shift P", "panel on/off"], ["a r f d", "approve · reject · freeze · delete"],
    ["0–5", "stars"], ["n", "write a comment"], ["v", "guided review"], ["j k", "next / previous element"],
    ["Alt click", "the enclosing element"], ["Ctrl click", "follow a link"], ["Esc", "close the card"], ["F1", "this help"]];
  const HELP_LINKS = [["Docs", "https://deciwa.danwos.dev"], ["danwos.dev", "https://danwos.dev"],
    ["LinkedIn", "https://www.linkedin.com/in/daniel-woste-362b6252"]];
  function helpBody() {
    return `<div class="about"><img src="${MONSTER}" alt=""><div><b>deciwa</b><span>decision watcher</span></div></div>
      <p>Point at an element of a doc or website and give feedback, rate it or decide on it. deciwa keeps that tied to exactly that element, notices when it changes and shows what is confirmed, open or frozen.</p>
      <h4>Keys</h4>
      <dl class="helpkeys">${HELP_KEYS.map(([k, v]) => `<dt>${k.split(" ").map(c => `<kbd>${esc(c)}</kbd>`).join(" ")}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <h4>Version</h4><p class="mono">${esc(buildLine())}</p>
      <h4>Author</h4><p>Daniel Woste · danwos</p>
      <p class="links">${HELP_LINKS.map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${l} ↗</a>`).join("")}</p>`;
  }
  function showHelp() {
    panelTab = "help";
    if (!panel.classList.contains("on")) togglePanel(); else { savePanelPrefs(); drawPanel(); }
  }

  async function drawPanel() {
    const tab = panelTab;
    const body = tab === "project" ? await projectBody() : tab === "files" ? filesBody() : tab === "help" ? helpBody() : pageBody();
    if (tab !== panelTab) return;  // switched while loading
    const openDetails = [...panel.querySelectorAll("details[data-k]")].filter(d => d.open).map(d => d.dataset.k);
    const offline = mode === "offline" && tab !== "files" && tab !== "help" ? `<div class="offline"><span class="chip off">offline</span>
        <span class="hint">${Offline.count()} entries in this browser</span>
        <button class="btn" data-tab="files">Im/Export</button></div>` : "";
    panel.innerHTML = `<div class="tbar"><img class="logo" src="${MONSTER}" alt=""><div class="kind">deciwa</div>
        <b>${tab === "project" ? "Whole project" : tab === "files" ? "Import and export" : tab === "help" ? "Help" : esc(PAGE.title || document.title.split(" - ")[0])}</b>
        ${docked ? "" : `<button class="x" title="Close (Shift+P)">×</button>`}
        <div class="tabs"><button data-tab="page" class="${tab === "page" ? "on" : ""}">This page</button><button data-tab="project" class="${tab === "project" ? "on" : ""}">Project</button><button data-tab="files" class="${tab === "files" ? "on" : ""}">Im/Export</button><button data-tab="help" class="help ${tab === "help" ? "on" : ""}" title="Help (F1)" aria-label="Help">?</button></div></div>
      <div class="inner">${offline}${body}</div>`;
    if (tab === "files") wireFiles();
    panel.querySelector("[data-guided]")?.addEventListener("click", () => setGuided(!guided));
    panel.querySelectorAll("details").forEach((d, n) => { d.dataset.k = d.classList.contains("rules") ? "rules" : "pg" + n; });
    panel.querySelectorAll("details[data-k]").forEach(d => { if (openDetails.includes(d.dataset.k) && d.dataset.k === "rules") d.open = true; });
    if (!docked) panel.querySelector(".x").onclick = togglePanel;
    panel.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { panelTab = b.dataset.tab; savePanelPrefs(); drawPanel(); });
    panel.querySelectorAll(".kinds input").forEach(cb => cb.onchange = async () => {
      const kinds = [...panel.querySelectorAll(".kinds input:checked")].map(i => i.value);
      try { await api("/api/rules", { required: kinds }); toast("Review rules saved"); refresh(); }
      catch (err) { toast(err.message); }
    });
    panel.querySelectorAll(".item[data-sel]").forEach(it => it.onclick = () => {
      if (!docked && innerWidth <= 560 && panel.classList.contains("on")) togglePanel();  // on a phone the panel covers the page
      goTo(it.dataset.doc, it.dataset.sel, it.dataset.src);
    });
    if (host.openDoc) panel.querySelectorAll(".quiet a[data-doc]").forEach(a => a.onclick = ev => {
      ev.preventDefault();
      goTo(a.dataset.doc, null, a.dataset.src);
    });
  }

  // -- feedback card ---------------------------------------------------------
  // word diff: only what changed, with a few words around it
  function diff(a, b) {
    const plain = t => String(t).replace(/\*\*|`/g, "");  // drop Markdown emphasis and code marks for reading
    const A = plain(a).split(/(\s+)/), B = plain(b).split(/(\s+)/);
    let i = 0;
    while (i < A.length && i < B.length && A[i] === B[i]) i++;
    let j = 0;
    while (j < A.length - i && j < B.length - i && A[A.length - 1 - j] === B[B.length - 1 - j]) j++;
    const ctx = 10;  // tokens = about five words
    const pre = A.slice(Math.max(0, i - ctx), i).join(""), post = A.slice(A.length - j, A.length - j + ctx).join("");
    const del = A.slice(i, A.length - j).join(""), add = B.slice(i, B.length - j).join("");
    return `<div class="diff">${i > ctx ? "… " : ""}${esc(pre)}${del ? `<span class="del">${esc(del)}</span>` : ""}${add ? `<span class="add">${esc(add)}</span>` : ""}${esc(post)}${A.length - j + ctx < A.length ? " …" : ""}</div>`;
  }

  function histItem(a) {
    const what = a.kind === "rating" ? `${"★".repeat(a.stars)}${"☆".repeat(5 - a.stars)}` : a.kind === "request" ? "Question" : LABELS[a.verdict] || a.verdict;
    const c = a.kind === "rating" ? "rated" : a.kind === "request" ? "requested" : COLORS[a.verdict] || "note";
    const actions = [];
    actions.push(`<button data-do="delete" data-id="${a.id}">remove</button>`);
    const replies = (a.replies || []).map(r =>
      `<div class="reply">↳ ${esc(r.author)}: ${esc(r.verdict ? r.verdict + " " : "")}${esc(r.text || "")}</div>`).join("");
    const changed = a.changed && ["approve", "freeze"].includes(a.verdict) ? diff(a.target.snapshot, a.current) : "";
    return `<div class="h" style="--c:${cv(c)}">
      <div class="meta"><b>${esc(what)}</b> · ${esc(a.author)} · ${esc(a.created.slice(0, 16).replace("T", " "))} ${actions.join(" ")}</div>
      ${a.comment ? `<div>${esc(a.comment)}</div>` : ""}${a.question ? `<div>? ${esc(a.question)}</div>` : ""}
      ${a.target.selectors.some(s => s.type === "TextQuoteSelector") ? `<div class="quote">“${esc(a.target.snapshot)}”</div>` : ""}
      ${changed}${replies}</div>`;
  }

  function openCard(e, reposition = true, scroll = true) {
    if (reposition && e !== current) card.classList.remove("moved");
    const keepText = !reposition && current === e ? card.querySelector("textarea")?.value : "";
    current = e;
    const st = view.elements[e.selector] || { state: "unreviewed", annotations: [] };
    const anns = st.annotations || [];
    const asks = anns.filter(a => a.kind === "request" && a.status === "open");
    const rated = st.stars ?? null;
    card.querySelector(".body").innerHTML = `
      <div class="tbar"><div class="kind">${esc(e.kind)} <span class="pill" style="--c:${cv(STATE_C[st.state])}">${esc(st.state)}</span>${isRequired(e.selector) ? `<span class="pill req" title="Must be approved (review rules)">must be approved</span>` : ""}</div>
        <b>${esc(e.label)}</b><div class="sel" title="${esc(e.selector)}">${esc(e.selector)}</div>
        <button class="x" title="Close (Esc)">×</button></div>
      <div class="dwr-form">
      ${quote ? `<div class="quote">Selection: “${esc(quote.exact)}”</div>` : ""}
      ${asks.map(a => `<div class="ask" data-id="${a.id}"><div class="q"><b>${esc(a.author)} asks:</b> ${esc(a.question)}</div>
        <div class="row"><button class="btn fill" style="--c:var(--approved)" data-ans="approve">✓ Yes</button><button class="btn fill" style="--c:var(--rejected)" data-ans="reject">✗ No</button></div>
        <div class="row"><input placeholder="… or answer in words"><button class="btn primary" data-ans="text">Send</button></div></div>`).join("")}
      <div class="sec"><label>Verdict <kbd>n</kbd></label>
        <textarea placeholder="Write an optional comment …"></textarea>
        <div class="acts">${Object.entries(ACTS).map(([v, a]) =>
          `<button class="btn fill" data-v="${v}" style="--c:${cv(a.c)}" title="${esc(a.tip)}"><span class="ico">${a.ico}</span>${a.label}<kbd>${a.key}</kbd></button>`).join("")}
          <button class="btn fill note" data-send style="--c:var(--note)" title="Save the comment without a verdict (Ctrl+Enter)"><span class="ico">💬</span>Comment only<kbd>⌃↵</kbd></button></div></div>
      <div class="sec"><label>Quality <kbd>0–5</kbd></label>
        <div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" class="${rated !== null && n <= rated ? "on" : ""}" title="${n} (key ${n})">★</button>`).join("")}
          ${rated !== null ? `<span class="val">${rated}/5</span>` : ""}</div></div>
      ${mode === "offline" ? `<div class="foot"><span class="chip off" title="No server – the review is kept in this browser">offline</span></div>` : ""}
      ${anns.length ? `<div class="hist">${anns.slice().reverse().map(histItem).join("")}</div>` : ""}
    </div>`;
    if (keepText) card.querySelector("textarea").value = keepText;
    card.classList.add("on");
    placeCard(e, reposition && scroll);
    place(focusBox, e.node);
    wireCard();
  }

  // the card never covers its element: beside the text if there is room,
  // otherwise below it – above only when the page ends too soon
  function placeCard(e, scroll) {
    if (card.classList.contains("moved")) return;  // the reviewer put it somewhere else
    const r = e.node.getBoundingClientRect(), f = frame(), o = origin();
    const article = host.article()?.getBoundingClientRect() || r;
    const right = f.right - (!docked && panel.classList.contains("on") ? panel.offsetWidth + 12 : 0);
    const w = card.offsetWidth, h = card.offsetHeight, gap = 12;
    let left, top;
    if (article.right + 16 + w <= right) {
      left = article.right + 16;
      top = r.top;
    } else {
      left = Math.max(f.left + 8, Math.min(r.left, right - w - 8));
      const below = r.bottom + o.y + gap;
      const docEnd = contentHeight();
      top = below + h <= docEnd - 8 || r.top + o.y - h - gap < 0 ? r.bottom + gap : r.top - h - gap;
    }
    card.style.left = `${left + o.x}px`;
    card.style.top = `${top + o.y}px`;
    if (scroll) {  // bring the card into view, keeping as much of the element visible as possible
      const cr = card.getBoundingClientRect();
      if (cr.bottom > f.bottom - 70) scrollView({ top: cr.bottom - f.bottom + 80, behavior: "smooth" });
      else if (cr.top < f.top + 8) scrollView({ top: cr.top - f.top - 16, behavior: "smooth" });
    }
  }

  // drag the card by its bar, like a window; only for this card
  card.addEventListener("pointerdown", ev => {
    const bar = ev.target.closest(".tbar");
    if (!bar || ev.target.closest("button") || ev.button !== 0) return;
    ev.preventDefault();
    const startX = ev.clientX, startY = ev.clientY;
    const left0 = parseFloat(card.style.left) || 0, top0 = parseFloat(card.style.top) || 0;
    card.classList.add("dragging");
    bar.setPointerCapture(ev.pointerId);
    const move = m => {
      card.classList.add("moved");
      const f = frame(), o = origin();
      const maxLeft = o.x + f.right - card.offsetWidth - 4;
      card.style.left = `${Math.max(o.x + f.left + 4, Math.min(maxLeft, left0 + m.clientX - startX))}px`;
      card.style.top = `${Math.max(o.y + f.top + 4, top0 + m.clientY - startY)}px`;
    };
    const up = () => {
      card.classList.remove("dragging");
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  });

  function closeCard() { card.classList.remove("on", "moved"); focusBox.style.display = "none"; current = null; quote = null; }

  function act(verdict) {
    const text = card.querySelector("textarea")?.value.trim() || "";
    if (verdict === "note" && !text) { card.querySelector("textarea").focus(); return toast("Write a comment first"); }
    save("feedback", { verdict, ...(text ? { comment: text } : {}) });
  }

  function wireCard() {
    card.querySelectorAll("[data-v]").forEach(b => b.onclick = () => act(b.dataset.v));
    card.querySelector("[data-send]").onclick = () => act("note");
    card.querySelector(".tbar .x").onclick = closeCard;
    card.querySelectorAll("[data-star]").forEach(b => b.onclick = () => save("rating", { stars: +b.dataset.star }));
    card.querySelectorAll(".ask").forEach(box => box.querySelectorAll("[data-ans]").forEach(b => b.onclick = async () => {
      const kind = b.dataset.ans, text = box.querySelector("input").value.trim();
      if (kind === "text" && !text) return toast("Type an answer first");
      await api("/api/reply", { id: box.dataset.id, text, verdict: kind === "text" ? null : kind, status: "resolved" });
      toast("Answer saved"); refresh();
    }));
    card.querySelectorAll("[data-do]").forEach(b => b.onclick = async () => {
      const id = b.dataset.id, what = b.dataset.do;
      if (what === "resolve") await api("/api/reply", { id, status: "resolved", text: "done" });
      if (what === "delete") { await api("/api/delete", { id }); toast("Removed"); }
      refresh();
    });
    card.querySelector("textarea").onkeydown = ev => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); act("note"); }
    };
  }

  // -- free text selection -----------------------------------------------------
  function selectionQuote(e) {
    const s = getSelection();
    if (!s || s.isCollapsed) return null;
    const exact = s.toString().replace(/\s+/g, " ").trim();
    if (!exact || !e.node.contains(s.anchorNode)) return null;
    const all = e.node.textContent.replace(/\s+/g, " ");
    const i = all.indexOf(exact);
    return { exact, prefix: i > 0 ? all.slice(Math.max(0, i - 24), i) : "",
             suffix: i >= 0 ? all.slice(i + exact.length, i + exact.length + 24) : "" };
  }

  // -- events ------------------------------------------------------------------
  // in review mode a click on an element reviews it, even through a link on or
  // in it (a card that is one big link); Ctrl/Cmd+click still follows the link.
  // Links outside the reviewable content (navigation) keep working.
  let blockClick = false;
  function linkedElement(ev, link, up) {
    const e = elementAt(ev.target, up);
    if (e && link.contains(e.node)) return e;
    const under = document.elementsFromPoint(ev.clientX, ev.clientY).find(n => !link.contains(n));
    const u = under && elementAt(under, up);
    return u && !u.node.contains(link) ? u : null;
  }
  const pick = (ev, link, up) => (link && linkedElement(ev, link, up)) || elementAt(ev.target, up);
  on(document, "mousedown", () => { blockClick = false; }, true);
  on(document, "click", ev => {
    if (blockClick) { ev.preventDefault(); ev.stopPropagation(); blockClick = false; }
  }, true);

  on(document, "mousemove", ev => {
    if (!reviewOn || inUI(ev)) return;
    const e = pick(ev, ev.target.closest("a[href]"), ev.altKey ? 1 : 0);
    hovered = e;
    if (!e) { hoverBox.style.display = "none"; return; }
    place(hoverBox, e.node);
    hoverBox.querySelector(".tag").textContent = e.selector;
  });

  on(document, "mouseup", ev => {
    if (!reviewOn || inUI(ev) || ev.button !== 0) return;
    if (ev.target.closest(".needs_collapse")) return;  // the need's own metadata toggle
    const link = ev.target.closest("a[href]");
    if (link && (ev.ctrlKey || ev.metaKey)) return;  // follow the link
    const e = pick(ev, link, ev.altKey ? 1 : 0);
    if (!e) { if (current && !link) closeCard(); return; }  // a click next to the content closes the card
    if (link) blockClick = true;
    quote = selectionQuote(e);
    if (!quote && getSelection() && !getSelection().isCollapsed) return;
    openCard(e);
  });

  on(document, "keydown", ev => {
    const t0 = ev.composedPath()[0];
    const typing = t0.closest && t0.closest("textarea, input, select, [contenteditable]");
    // in a host, a key deciwa uses is not seen by the host's own shortcuts
    const mine = () => { ev.preventDefault(); if (hostKeys) ev.stopPropagation(); };
    if (ev.key === "Escape") { closeModal(); closeCard(); return; }
    if (hostKeys && !reviewOn) return;  // the host owns the keys outside review mode
    if (ev.key === "F1") { if (hostKeys) return; ev.preventDefault(); showHelp(); return; }
    if (typing) return;
    if (ev.shiftKey && ev.key === "R") { if (hostKeys) return; toggleReview(); return; }
    if (ev.shiftKey && ev.key === "P") { if (hostKeys) return; togglePanel(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
    if (ev.key === "v") { mine(); setGuided(!guided); return; }
    if (!reviewOn) return;
    if (ev.key === "j" || ev.key === "k") { mine(); guideStep(ev.key === "j" ? 1 : -1); return; }
    const target = current || hovered;
    if (!target) return;
    if (KEY2ACT[ev.key]) {
      mine(); ev.stopPropagation();
      if (!current) openCard(target);
      act(KEY2ACT[ev.key]);
    } else if (ev.key === "n") {
      mine();
      if (!current) openCard(target);
      card.querySelector("textarea").focus();
    } else if (/^[0-5]$/.test(ev.key)) {
      mine();
      if (!current) openCard(target);
      save("rating", { stars: +ev.key });
    }
  }, true);

  // the tool pill shrinks to the round logo while neither review nor panel is on
  function updateTools() {
    $(".dwr-tools").classList.toggle("mini", !reviewOn && !panel.classList.contains("on"));
  }
  $(".dwr-tools .brand").onclick = () => $(".dwr-tools").classList.toggle("peek");
  function applyReview() {
    updateTools();
    $('[data-t="review"]').classList.toggle("on", reviewOn);
    document.body.classList.toggle("dwr-on", reviewOn);
    bars.style.display = reviewOn ? "" : "none";
  }
  function toggleReview() {
    reviewOn = !reviewOn;
    savePanelPrefs();
    applyReview();
    host.onReview?.(reviewOn);
    if (!reviewOn) { hoverBox.style.display = "none"; closeCard(); }
  }
  function togglePanel() {
    if (docked) return;
    panel.classList.toggle("on");
    if (current) openCard(current);
    $('[data-t="panel"]').classList.toggle("on", panel.classList.contains("on"));
    savePanelPrefs();
    updateTools();
    if (panel.classList.contains("on")) drawPanel();
  }
  $('[data-t="review"]').onclick = ev => { ev.currentTarget.blur(); $(".dwr-tools").classList.remove("peek"); toggleReview(); };
  $('[data-t="panel"]').onclick = ev => { ev.currentTarget.blur(); $(".dwr-tools").classList.remove("peek"); togglePanel(); };

  // bars and frames sit at absolute positions: redraw whenever the layout moves
  // (needs folded open, pictures or fonts loaded, the window resized …)
  let layoutQueued = false;
  function relayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      drawBars();
      if (current) { place(focusBox, current.node); placeCard(current, false); }
      if (hovered && hoverBox.style.display === "block") place(hoverBox, hovered.node);
    });
  }
  on(window, "resize", relayout);
  const ro = "ResizeObserver" in window ? new ResizeObserver(relayout) : null;
  function observe() {
    ro?.observe(document.body);
    for (const e of els) ro?.observe(e.node);
    (host.article() || document).querySelectorAll("img").forEach(img => img.complete || img.addEventListener("load", relayout, { once: true }));
  }
  observe();
  document.fonts?.ready.then(relayout);

  // -- live reload after a rebuild ---------------------------------------------
  const SCROLL_KEY = "deciwa-scroll:" + location.pathname;
  try {
    const y = host.api ? null : sessionStorage.getItem(SCROLL_KEY);
    if (y !== null) { sessionStorage.removeItem(SCROLL_KEY); on(window, "load", () => scrollTo(0, +y)); }
  } catch (_) { /* storage blocked */ }

  let pollTimer = null;
  async function poll() {
    if (destroyed) return;
    try {
      const v = await (await fetch("/api/version", { cache: "no-store" })).json();
      if (version !== null && v.version !== version && !v.building) {
        try { sessionStorage.setItem(SCROLL_KEY, String(scrollY)); } catch (_) {}
        location.reload();
        return;
      }
      if (!v.building) version = v.version;
    } catch (_) { /* server gone */ }
    pollTimer = setTimeout(poll, 1500);
  }

  applyReview();
  if (panelPrefs.open) { panel.classList.add("on"); $('[data-t="panel"]').classList.add("on"); }
  updateTools();
  refresh().then(() => {
    if (destroyed) return;
    if (online && mode === "server" && !host.api) poll();
    const m = host.focus ? null : location.hash.match(/^#deciwa=(.+)$/);
    if (m) history.replaceState(null, "", location.pathname + location.search);
    const focus = host.focus || (m && decodeURIComponent(m[1]));
    if (focus) goTo(null, focus);
    else if (guided && reviewOn) guideStep(1);
  });
  on(window, "load", relayout);

  // the page changed (client-side navigation, new content): new elements, same UI
  function update(list, page) {
    if (page) PAGE = page;
    const keep = current && list.find(e => e.selector === current.selector && e.node);
    if (current && !keep) closeCard();
    hovered = null; hoverBox.style.display = "none";
    setElements(list);
    if (keep) current = keep;
    observe();
    refresh();
  }

  // -- for hosts ------------------------------------------------------------------
  // put the panel into the host's own side panel (inside an element of class "dwr")
  function dock(el) {
    docked = true;
    el.appendChild(panel);
    panel.classList.add("docked", "on");
    drawPanel();
    if (current) placeCard(current, false);
  }
  function undock() {
    if (!docked) return;
    docked = false;
    panel.classList.remove("docked");
    panel.classList.toggle("on", panelPrefs.open === true);
    ui.appendChild(panel);
  }
  function setReview(on_) { if (on_ !== reviewOn) toggleReview(); }
  function destroy() {
    destroyed = true;
    for (const [t, type, fn, opts] of listeners) t.removeEventListener(type, fn, opts);
    ro?.disconnect();
    clearTimeout(pollTimer);
    for (const e of els) delete e.node.dataset.dwKey;
    document.body.classList.remove("dwr-on");
    panel.remove();
    ui.remove();
  }
  return { update, refresh, destroy, dock, undock, setReview, toggleReview, focus: sel => goTo(null, sel),
    get review() { return reviewOn; } };
}
