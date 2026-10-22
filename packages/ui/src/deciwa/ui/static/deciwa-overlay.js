/* deciwa review overlay 0.2.41 – built from packages/ui/js/ (npm run build), do not edit */
(() => {
  // <define:__BUILD__>
  var define_BUILD_default = { version: "0.2.41", commit: "85fc1e9", dirty: true, date: "2026-10-22" };

  // js/hash.js
  var enc = new TextEncoder();
  async function sha256(text) {
    const bytes = enc.encode(text);
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      return hex(new Uint8Array(buf));
    }
    return hex(fallback(bytes));
  }
  var hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  var K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  function fallback(msg) {
    const len = msg.length, padded = new Uint8Array(len + 9 + 63 >> 6 << 6);
    padded.set(msg);
    padded[len] = 128;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(len / 536870912));
    view.setUint32(padded.length - 4, len << 3 >>> 0);
    const H = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
    const W = new Uint32Array(64);
    const rot = (x, n) => x >>> n | x << 32 - n;
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rot(W[i - 15], 7) ^ rot(W[i - 15], 18) ^ W[i - 15] >>> 3;
        const s1 = rot(W[i - 2], 17) ^ rot(W[i - 2], 19) ^ W[i - 2] >>> 10;
        W[i] = W[i - 16] + s0 + W[i - 7] + s1;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + (e & f ^ ~e & g) + K[i] + W[i];
        const t2 = (rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + (a & b ^ a & c ^ b & c);
        h = g;
        g = f;
        f = e;
        e = d + t1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 >>> 0;
      }
      H[0] += a;
      H[1] += b;
      H[2] += c;
      H[3] += d;
      H[4] += e;
      H[5] += f;
      H[6] += g;
      H[7] += h;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    H.forEach((x, i) => ov.setUint32(i * 4, x));
    return out;
  }

  // js/overlay.js
  function startOverlay(host) {
    let PAGE = host.page;
    const hostKeys = host.keys === "review";
    const listeners = [];
    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      listeners.push([target, type, fn, opts]);
    }
    let destroyed = false;
    const scroller = host.scroller || null;
    function frame() {
      if (!scroller) return { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
      return scroller.getBoundingClientRect();
    }
    function origin() {
      if (!scroller) return { x: scrollX, y: scrollY };
      const r = scroller.getBoundingClientRect();
      return { x: scroller.scrollLeft - r.left - scroller.clientLeft, y: scroller.scrollTop - r.top - scroller.clientTop };
    }
    const scrollView = (opts) => (scroller || window).scrollBy(opts);
    const contentHeight = () => scroller ? scroller.scrollHeight : document.documentElement.scrollHeight;
    const ACTS = {
      approve: { label: "Approve", ico: "\u2713", key: "a", c: "approved", tip: "Confirm the statement \u2013 it becomes a decision" },
      reject: { label: "Reject", ico: "\u2717", key: "r", c: "rejected", tip: "The statement is wrong" },
      freeze: { label: "Approve & freeze", ico: "\u2744", key: "f", c: "frozen", tip: "Approve and keep exactly as it is \u2013 the AI must never change it" },
      delete: { label: "Delete", ico: "\u{1F5D1}", key: "d", c: "change", tip: "Job for the AI: remove this element" }
    };
    const LABELS = {
      ...Object.fromEntries(Object.entries(ACTS).map(([v, a]) => [v, a.label])),
      note: "Comment",
      rephrase: "Rephrase",
      details: "More details"
    };
    const COLORS = {
      approve: "approved",
      reject: "rejected",
      freeze: "frozen",
      delete: "change",
      rephrase: "change",
      details: "change",
      note: "note"
    };
    const describe = (a) => !a ? "" : a.comment || a.question || (a.kind === "feedback" ? LABELS[a.verdict] || a.verdict : "");
    const KEY2ACT = Object.fromEntries(Object.entries(ACTS).map(([v, a]) => [a.key, v]));
    const MONSTER = host.monster;
    const STATE_C = {
      "approved": "approved",
      "stale": "stale",
      "frozen": "frozen",
      "frozen, but changed": "broken",
      "changes requested": "change",
      "rejected": "rejected",
      "requested": "requested",
      "unreviewed": "note",
      "orphaned": "orphaned"
    };
    const cv = (name) => `var(--${name})`;
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    let els = [], bySel = {}, byKey = {};
    function setElements(list) {
      for (const e of els) delete e.node.dataset.dwKey;
      els = list.filter((e) => e.node);
      bySel = {};
      for (const e of els) {
        e.node.dataset.dwKey = e.key;
        bySel[e.selector] = e;
      }
      byKey = Object.fromEntries(els.map((e) => [e.key, e]));
    }
    setElements(host.elements);
    const inUI = (ev) => {
      const path = ev.composedPath();
      return path.includes(ui) || path.includes(panel);
    };
    function elementAt(target, up = 0) {
      const chain = [];
      for (let n = target; n && n !== document.body; n = n.parentElement) {
        const e = n.dataset && n.dataset.dwKey && byKey[n.dataset.dwKey];
        if (!e) continue;
        if (e.kind === "heading" && chain.length === 0 && !n.classList.contains("dw-range")) {
          const h = /^H[1-6]$/.test(n.tagName) ? n : n.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6");
          if (!(h && h.contains(target))) continue;
        }
        chain.push(e);
      }
      return chain[Math.min(up, chain.length - 1)] || null;
    }
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
      <button class="x" title="Close (Esc)">\xD7</button></div><div class="tools"><button class="btn" data-copy>Copy</button></div><pre></pre></div></div>
    <div class="dwr-toast"></div>`;
    host.mount.appendChild(ui);
    if (host.tools === false) ui.querySelector(".dwr-tools").style.display = "none";
    const $ = (s) => ui.querySelector(s);
    const hoverBox = $(".dwr-box.hover"), focusBox = $(".dwr-box.focus"), card = $(".dwr-card");
    const panel = $(".dwr-panel"), bars = $(".dwr-bars");
    let view = { elements: {}, orphans: [] };
    const PANEL_KEY = "deciwa-panel";
    const panelPrefs = (() => {
      try {
        return JSON.parse(localStorage.getItem(PANEL_KEY)) || {};
      } catch (_) {
        return {};
      }
    })();
    let panelTab = ["project", "files", "help"].includes(panelPrefs.tab) ? panelPrefs.tab : "page";
    function savePanelPrefs() {
      try {
        localStorage.setItem(PANEL_KEY, JSON.stringify({ open: docked ? panelPrefs.open === true : panel.classList.contains("on"), tab: panelTab, review: reviewOn, guided }));
      } catch (_) {
      }
    }
    let guided = panelPrefs.guided === true;
    let docked = false;
    let online = false, reviewOn = panelPrefs.review === true, hovered = null, current = null, quote = null, version = null;
    function toast(msg) {
      const t = $(".dwr-toast");
      t.textContent = msg;
      t.classList.add("on");
      clearTimeout(toast.t);
      toast.t = setTimeout(() => t.classList.remove("on"), 1800);
    }
    function place(box, node) {
      const r = node.getBoundingClientRect(), o = origin();
      Object.assign(box.style, {
        display: "block",
        left: `${r.left + o.x - 4}px`,
        top: `${r.top + o.y - 3}px`,
        width: `${r.width + 8}px`,
        height: `${r.height + 6}px`
      });
    }
    let mode = "server";
    async function api(path, body) {
      if (mode === "offline") return Offline.call(path, body);
      if (host.api) return host.api(path, body);
      const res = await fetch(path, body ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      } : void 0);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "error");
      return data.result;
    }
    const VERDICTS = ["approve", "reject", "freeze", "delete", "rephrase", "details"];
    const hasVerdict = (st) => !!st && st.annotations.some((a) => a.kind === "feedback" && VERDICTS.includes(a.verdict));
    const Offline = (() => {
      const KEY = host.storageKey;
      let index = { pages: {} }, base = { files: {} }, cfg = { review: { required: [], paths: [] } }, data = null;
      const QUICK = ["rephrase", "details", "delete"], DONE_ = ["approved", "frozen"];
      const norm = (t) => String(t || "").normalize("NFC").replace(/\s+/g, " ").trim();
      const hash = async (t) => "sha256:" + await sha256(norm(t));
      const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "abcdefghijklmnopqrstuvwxyz234567"[b % 32]).join("");
      const now = () => (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d+Z$/, "Z");
      const glob = (pat, str) => new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$").test(str);
      function persist() {
        data.updated = now();
        try {
          localStorage.setItem(KEY, JSON.stringify(data));
        } catch (_) {
        }
      }
      async function init() {
        ({ elements: index, annotations: base, config: cfg } = await host.loadData());
        try {
          data = JSON.parse(localStorage.getItem(KEY));
        } catch (_) {
          data = null;
        }
        if (!data) data = { files: structuredClone(base.files || {}), review: structuredClone(cfg.review), author: "reviewer" };
        return cfg.mode || "auto";
      }
      const pageOf = (src) => Object.values(index.pages).find((p) => p.source === src) || { elements: [] };
      const anns = (src) => data.files[src] || [];
      function store(src, list) {
        if (list.length) data.files[src] = list;
        else delete data.files[src];
        persist();
      }
      function resolve(a, els2) {
        const sels = a.target.selectors;
        const structural = sels.find((x) => x.type === "structural")?.value;
        const quote2 = sels.find((x) => x.type === "TextQuoteSelector");
        let el = els2.find((e) => e.selector === structural);
        if (!el) {
          const snap = norm(a.target.snapshot);
          const hits = els2.filter((e) => norm(e.text) === snap || quote2 && norm(e.text).includes(snap));
          if (hits.length !== 1) return [null, false];
          el = hits[0];
        }
        const changed = quote2 ? !norm(el.text).includes(norm(quote2.exact)) : el.fingerprint !== a.target.fingerprint;
        return [el, changed];
      }
      function state(list) {
        const fb = list.filter((a) => a.kind === "feedback");
        const freezes = fb.filter((a) => a.verdict === "freeze");
        const actions = fb.filter((a) => QUICK.includes(a.verdict) && a.status === "open");
        const decisive = fb.filter((a) => a.verdict === "approve" || a.verdict === "reject" && a.status === "open");
        const requests = list.filter((a) => a.kind === "request" && a.status === "open");
        const ratings = list.filter((a) => a.kind === "rating");
        let st = "unreviewed";
        if (freezes.length) st = freezes.at(-1).changed ? "frozen, but changed" : "frozen";
        else if (actions.length) st = "changes requested";
        else if (decisive.length) st = decisive.at(-1).verdict === "reject" ? "rejected" : decisive.at(-1).changed ? "stale" : "approved";
        else if (requests.length) st = "requested";
        return { state: st, requested: !!requests.length, stars: ratings.length ? ratings.at(-1).stars : null, annotations: list };
      }
      function isRequired2(src, e) {
        const r = data.review;
        if (r.paths.length && !r.paths.some((p) => glob(p, src))) return false;
        return r.required.some((x) => x === "all" || x === e.kind || x.includes(":") && glob(x, e.selector));
      }
      function view2(src) {
        var _a;
        const els2 = pageOf(src).elements, per = {}, orphans = [];
        for (const a of anns(src)) {
          const [el, changed] = resolve(a, els2);
          const item2 = { ...a, changed };
          if (!el) {
            orphans.push({ ...item2, state: "orphaned" });
            continue;
          }
          item2.element = el.selector;
          item2.current = el.text;
          (per[_a = el.selector] || (per[_a] = [])).push(item2);
        }
        const elements = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, state(v)]));
        return { source: src, elements, orphans, required: els2.filter((e) => isRequired2(src, e)).map((e) => e.selector), rules: data.review };
      }
      function replacedBy(n, o, sel) {
        if (o.author !== n.author || o.kind !== n.kind || o.target.fingerprint !== n.target.fingerprint) return false;
        if (!o.target.selectors.some((x) => x.type === "structural" && x.value === sel)) return false;
        const q = (a) => JSON.stringify(a.target.selectors.filter((x) => x.type === "TextQuoteSelector"));
        if (q(o) !== q(n)) return false;
        if (n.kind === "rating") return true;
        return n.kind === "feedback" && n.verdict !== "note" && o.verdict !== "note";
      }
      async function add({ source, selector, kind, quote: quote2, ...f }) {
        const el = pageOf(source).elements.find((e) => e.selector === selector);
        if (!el) throw new Error("element not found \u2013 reload the page");
        if (kind === "feedback" && f.verdict === "note" && !f.comment) throw new Error("a note needs a comment");
        const selectors = [{ type: "structural", value: selector }];
        let snapshot = el.text, fp = el.fingerprint;
        if (quote2) {
          selectors.push({ type: "TextQuoteSelector", ...quote2 });
          snapshot = quote2.exact;
          fp = await hash(quote2.exact);
        }
        const open = kind === "request" || kind === "feedback" && [...QUICK, "reject", "note"].includes(f.verdict);
        const ann = {
          id: newId(),
          kind,
          target: { selectors, fingerprint: fp, snapshot },
          author: data.author,
          created: now(),
          status: open ? "open" : "resolved",
          replies: []
        };
        for (const k of ["verdict", "stars", "comment", "question", "to"]) if (f[k] !== void 0 && f[k] !== null && f[k] !== "") ann[k] = f[k];
        const all = anns(source);
        const keep = all.filter((o) => !replacedBy(ann, o, selector));
        for (const o of all.filter((o2) => !keep.includes(o2)))
          if (o.comment && o.comment !== ann.comment) keep.push({ ...o, id: newId(), verdict: "note", status: "resolved" });
        keep.push(ann);
        store(source, keep);
        return ann;
      }
      function find(id) {
        for (const [src, list] of Object.entries(data.files)) {
          const a = list.find((x) => x.id === id);
          if (a) return [src, list, a];
        }
        throw new Error("annotation not found");
      }
      function project() {
        let total = 0, done = 0, decided = 0, rated = 0;
        const pages = Object.keys(index.pages).sort((a, b) => (a !== "index") - (b !== "index") || a.localeCompare(b)).map((doc) => {
          const pg = index.pages[doc], v = view2(pg.source), req = new Set(v.required);
          const items = pg.elements.filter((e) => v.elements[e.selector] || req.has(e.selector)).map((e) => {
            const st = v.elements[e.selector], last = st ? st.annotations.at(-1) : {};
            return {
              selector: e.selector,
              label: e.label,
              kind: e.kind,
              state: st ? st.state : "unreviewed",
              required: req.has(e.selector),
              decided: hasVerdict(st),
              rated: !!st && st.stars !== null,
              stars: st ? st.stars : null,
              requested: st ? st.requested : false,
              last: describe(st && last)
            };
          });
          const d = items.filter((i) => i.required && DONE_.includes(i.state)).length;
          const dc = items.filter((i) => i.required && i.decided).length, rt = items.filter((i) => i.required && i.rated).length;
          total += req.size;
          done += d;
          decided += dc;
          rated += rt;
          return { doc, source: pg.source, title: pg.title || doc, required: req.size, done: d, decided: dc, rated: rt, items, orphans: v.orphans.length };
        });
        return { required: total, done, decided, rated, pages, rules: data.review };
      }
      function call(path, body) {
        const [p, q] = path.split("?");
        const params = Object.fromEntries(new URLSearchParams(q || ""));
        if (p === "/api/page") return view2(params.source);
        if (p === "/api/project") return project();
        if (p === "/api/annotate") return add(body);
        if (p === "/api/rules") {
          data.review.required = [...body.required, ...data.review.required.filter((r) => r.includes(":"))];
          persist();
          return data.review;
        }
        const [src, list, a] = find(body.id);
        if (p === "/api/delete") {
          store(src, list.filter((x) => x.id !== body.id));
          return null;
        }
        if (p === "/api/reply") {
          if (body.text || body.verdict) a.replies.push({ author: data.author, created: now(), ...body.text ? { text: body.text } : {}, ...body.verdict ? { verdict: body.verdict } : {} });
          if (body.status) a.status = body.status;
          store(src, list);
          return a;
        }
        throw new Error("unknown action");
      }
      const exportData2 = () => ({
        deciwa: "0.1",
        exported: now(),
        updated: data.updated || null,
        origin: "browser",
        files: structuredClone(data.files),
        ...host.exportPages ? { pages: structuredClone(index.pages) } : {}
      });
      function importData(file) {
        if (!file || typeof file.files !== "object") throw new Error("not a deciwa export");
        data = { files: structuredClone(file.files), review: data.review, author: data.author };
        persist();
        return { annotations: count(), sources: Object.keys(data.files).length };
      }
      function reset() {
        data = { files: structuredClone(base.files || {}), review: structuredClone(cfg.review), author: data.author };
        persist();
      }
      const count = () => Object.values(data.files).reduce((n, l) => n + l.length, 0);
      const updated = () => data.updated || null;
      return { init, call, exportData: exportData2, importData, reset, count, updated };
    })();
    async function refresh() {
      if (PAGE.mode === "offline" && mode === "server") {
        try {
          await Offline.init();
          mode = "offline";
        } catch (_) {
          online = false;
        }
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
          } catch (_) {
            online = false;
          }
        } else online = false;
      }
      $(".warn").textContent = online ? "" : "read-only";
      drawBars();
      drawCounts();
      if (panel.classList.contains("on")) drawPanel();
      if (current) openCard(current, false);
    }
    async function save(kind, fields) {
      if (!online) return toast("read-only");
      try {
        await api("/api/annotate", { source: PAGE.source, selector: current.selector, kind, ...fields, ...quote ? { quote } : {} });
        toast(kind === "rating" ? `${fields.stars} \u2605 saved` : `${LABELS[fields.verdict] || kind} saved`);
        quote = null;
        const ta = card.querySelector("textarea");
        if (ta) ta.value = "";
        await refresh();
        if (guided && kind === "feedback" && fields.verdict !== "note") guideStep(1);
      } catch (err) {
        toast(err.message);
      }
    }
    const pending = () => els.filter((e) => (view.required || []).includes(e.selector) && !hasVerdict(view.elements[e.selector]));
    async function guideStep(dir) {
      const list = pending();
      const all = els.filter((e) => (view.required || []).includes(e.selector));
      const from = current ? all.indexOf(current) : -1;
      const ordered = dir > 0 ? all.slice(from + 1).concat(all.slice(0, from + 1)) : all.slice(0, Math.max(from, 0)).reverse().concat(all.slice(from).reverse());
      let next = ordered.find((e) => list.includes(e) && e !== current);
      if (next && dir > 0 && all.indexOf(next) <= from) next = null;
      if (next) return goTo(null, next.selector);
      if (dir < 0) return toast("No open element above");
      try {
        const pr = await api("/api/project");
        const docs = pr.pages.map((p) => p.doc), here = docs.indexOf(PAGE.doc);
        for (const pg of pr.pages.slice(here + 1).concat(pr.pages.slice(0, here + 1))) {
          const item2 = pg.items.find((i) => i.required && !i.decided);
          if (!item2) continue;
          if (pg.doc === PAGE.doc) return goTo(null, item2.selector);
          return goTo(pg.doc, item2.selector, pg.source);
        }
      } catch (_) {
      }
      toast("Done \u2013 every required element has a verdict");
      setGuided(false);
    }
    function setGuided(on2) {
      guided = on2;
      if (on2 && !reviewOn) toggleReview();
      savePanelPrefs();
      if (panel.classList.contains("on")) drawPanel();
      if (on2) {
        if (current && pending().includes(current)) openCard(current, false);
        else {
          closeCard();
          guideStep(1);
        }
      } else if (current) openCard(current, false);
    }
    const KIND_LABELS = {
      need: "Sphinx-Needs objects",
      heading: "Headings (sections)",
      paragraph: "Paragraphs",
      item: "List items",
      row: "Table rows",
      code: "Code blocks",
      note: "Notes, admonitions",
      figure: "Figures",
      class: "Classes (source code)",
      function: "Functions, methods",
      all: "Everything"
    };
    const DONE = ["approved", "frozen"];
    const isRequired = (sel) => (view.required || []).includes(sel);
    const stateName = (sel) => view.elements[sel]?.state || "unreviewed";
    const openRequired = () => (view.required || []).filter((sel) => bySel[sel] && !hasVerdict(view.elements[sel]));
    function drawBars() {
      bars.innerHTML = "";
      const article = host.article() || document.body;
      const o = origin();
      const left = article.getBoundingClientRect().left + o.x - 14;
      const sels = /* @__PURE__ */ new Set([...Object.keys(view.elements), ...view.required || []]);
      for (const sel of sels) {
        const e = bySel[sel];
        if (!e) continue;
        const st = view.elements[sel];
        const r = e.node.getBoundingClientRect();
        const b = document.createElement("div");
        b.className = "dwr-bar" + (st?.requested ? " req" : "") + (st ? "" : " todo");
        Object.assign(b.style, { left: `${left}px`, top: `${r.top + o.y}px`, height: `${Math.max(r.height, 14)}px` });
        if (st) b.style.background = cv(STATE_C[st.state]);
        b.title = st ? `${st.state}${st.stars != null ? ` \xB7 ${st.stars} \u2605` : ""}${st.requested ? " \xB7 question open" : ""}` : "must be approved \u2013 not reviewed yet";
        b.onclick = () => openCard(e);
        bars.appendChild(b);
      }
    }
    function drawCounts() {
      const c = {};
      for (const st of Object.values(view.elements)) c[st.state] = (c[st.state] || 0) + 1;
      if (view.orphans.length) c.orphaned = view.orphans.length;
      const open = Object.values(view.elements).filter((s) => s.requested).length;
      const req = (view.required || []).filter((sel) => bySel[sel]);
      const done = req.length - openRequired().length;
      $(".counts").innerHTML = (req.length ? `<span title="required elements with a verdict"><i class="todo"></i>${done}/${req.length}</span>` : "") + Object.entries(c).map(([s, n]) => `<span title="${esc(s)}"><i style="--c:${cv(STATE_C[s])}"></i>${n}</span>`).join("") + (open ? `<span title="open questions"><i style="--c:var(--requested)"></i>${open} ?</span>` : "");
    }
    function item(sel, state, text) {
      return `<div class="item${isRequired(sel) ? " required" : ""}" data-sel="${esc(sel)}" style="--c:${cv(STATE_C[state])}">
      <div class="t"><b>${esc(bySel[sel]?.label || sel)}</b><span>${esc(state)}${view.elements[sel]?.stars != null ? " \xB7 " + view.elements[sel].stars + "\u2605" : ""}</span></div>
      ${text ? `<div class="c">${esc(text)}</div>` : ""}</div>`;
    }
    const ORDER = ["frozen, but changed", "changes requested", "rejected", "requested", "stale", "unreviewed", "approved", "frozen"];
    function rulesBox(rules) {
      const patterns = rules.required.filter((r) => r.includes(":"));
      return `<details class="rules"><summary>Must be approved: ${esc(rules.required.join(", ") || "nothing")}</summary>
        <div class="kinds">${Object.entries(KIND_LABELS).map(([k, l]) => `<label><input type="checkbox" value="${k}" ${rules.required.includes(k) ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div>
        ${patterns.length ? `<div class="hint">Patterns: ${esc(patterns.join(", "))}</div>` : ""}
        ${rules.paths.length ? `<div class="hint">Only in: ${esc(rules.paths.join(", "))}</div>` : ""}
      </details>`;
    }
    const coverage = (decided, rated, total) => {
      if (!total) return `<div class="cov">Nothing required</div>`;
      const p = (n) => Math.round(100 * n / total);
      return `<div class="cov">
      <div class="legend"><span><i class="v"></i>Verdict <b>${p(decided)} %</b> \xB7 ${decided}/${total}</span>
        <span><i class="q"></i>Quality <b>${p(rated)} %</b> \xB7 ${rated}/${total}</span></div>
      <div class="track two"><i class="v" style="width:${p(decided)}%"></i><i class="q" style="width:${p(rated)}%"></i></div></div>`;
    };
    const guideButton = () => `<div class="row guided"><button class="btn${guided ? "" : " primary"}" data-guided>${guided ? "\u25A0 Stop guided" : "\u25B6 Guided review"}</button>
    <span class="keys"><kbd>v</kbd> ${guided ? "stop" : "start"} \xB7 <kbd>j</kbd> next \xB7 <kbd>k</kbd> previous</span></div>`;
    function pageBody() {
      var _a;
      const req = (view.required || []).filter((sel) => bySel[sel]);
      const todo = openRequired();
      const rated = req.filter((sel) => view.elements[sel]?.stars != null).length;
      let html = coverage(req.length - todo.length, rated, req.length) + guideButton() + rulesBox(view.rules || { required: [], paths: [] });
      if (todo.length) {
        html += `<h4>To review \xB7 ${todo.length}</h4>` + todo.map((sel) => {
          const last = view.elements[sel]?.annotations.at(-1);
          return item(sel, stateName(sel), describe(last));
        }).join("");
      }
      const groups = {};
      for (const [sel, st] of Object.entries(view.elements)) {
        if (todo.includes(sel)) continue;
        (groups[_a = st.state] || (groups[_a] = [])).push([sel, st]);
      }
      for (const s of ORDER) {
        if (!groups[s]) continue;
        html += `<h4>${esc(s)} \xB7 ${groups[s].length}</h4>` + groups[s].map(([sel, st]) => {
          const last = st.annotations.at(-1);
          return item(sel, s, describe(last));
        }).join("");
      }
      if (!todo.length && !Object.keys(view.elements).length && !view.orphans.length)
        html += `<div class="empty">Nothing on this page yet.</div>`;
      if (view.orphans.length) {
        html += `<h4>orphaned \xB7 ${view.orphans.length}</h4>`;
        for (const o of view.orphans) html += `<div class="item" style="--c:var(--orphaned)"><div class="t"><b>${esc(o.target.snapshot.slice(0, 80))}</b></div>
        <div class="c">${esc(o.target.selectors[0].value)}</div></div>`;
      }
      return html;
    }
    async function projectBody() {
      let data;
      try {
        data = await api("/api/project");
      } catch (_) {
        return `<div class="empty">read-only \u2013 start \u201Cdeciwa serve\u201D</div>`;
      }
      let html = coverage(data.decided, data.rated, data.required) + guideButton() + rulesBox(data.rules);
      const quiet = [];
      for (const pg of data.pages) {
        if (!pg.items.length) {
          quiet.push(pg);
          continue;
        }
        const open = pg.items.filter((i) => i.required && !i.decided).length;
        const items = pg.items.slice().sort((x, y) => (y.required && !y.decided) - (x.required && !x.decided) || ORDER.indexOf(x.state) - ORDER.indexOf(y.state));
        html += `<details class="pg"${pg.doc === PAGE.doc || open ? " open" : ""}>
        <summary><b>${esc(pg.title)}</b><span>${pg.required ? `${pg.decided}/${pg.required} \xB7 ${pg.rated}\u2605` : ""}${pg.orphans ? ` \xB7 ${pg.orphans} orphaned` : ""}</span></summary>
        ${items.map((i) => `<div class="item${i.required ? " required" : ""}" data-doc="${esc(pg.doc)}" data-src="${esc(pg.source)}" data-sel="${esc(i.selector)}" style="--c:${cv(STATE_C[i.state])}">
          <div class="t"><b>${esc(i.label)}</b><span>${esc(i.state)}${i.stars != null ? " \xB7 " + i.stars + "\u2605" : ""}${i.requested ? " \xB7 ?" : ""}</span></div>
          ${i.last ? `<div class="c">${esc(LABELS[i.last] || i.last)}</div>` : ""}</div>`).join("")}
      </details>`;
      }
      if (quiet.length) html += `<h4>No feedback \xB7 ${quiet.length} pages</h4><div class="quiet">${quiet.map((pg) => `<a href="${host.openDoc ? "#" : esc(host.docUrl(pg.doc))}" data-doc="${esc(pg.doc)}" data-src="${esc(pg.source)}">${esc(pg.title)}</a>`).join("")}</div>`;
      return html;
    }
    function goTo(doc, sel, source) {
      if (doc && doc !== PAGE.doc) {
        if (host.openDoc) return host.openDoc({ doc, source }, sel);
        location.href = `${host.docUrl(doc)}#deciwa=${encodeURIComponent(sel)}`;
        return;
      }
      const e = bySel[sel];
      if (!e) return;
      if (reviewOn) openCard(e, true, false);
      else {
        place(focusBox, e.node);
        setTimeout(() => {
          if (!current) focusBox.style.display = "none";
        }, 1600);
      }
      showInView(e.node, reviewOn ? card : null);
    }
    function showInView(node, extra) {
      const r = node.getBoundingClientRect(), f = frame();
      let top = r.top - f.top, bottom = r.bottom - f.top;
      if (extra) {
        const c = extra.getBoundingClientRect();
        top = Math.min(top, c.top - f.top);
        bottom = Math.max(bottom, c.bottom - f.top);
      }
      const room = f.height - (host.tools === false ? 16 : 90);
      if (top >= 8 && bottom <= room) return;
      const h = bottom - top;
      const delta = h <= room - 8 ? top - (room - h) / 2 : top - 16;
      scrollView({ top: delta, behavior: Math.abs(delta) > f.height * 2 ? "instant" : "smooth" });
    }
    let picked = null;
    const fmt = (t) => t ? t.replace("T", " ").replace("Z", " UTC") : "\u2013";
    function fileInfo(d) {
      const files = Object.entries(d.files || {});
      const anns = files.flatMap(([, l]) => l);
      const authors = [...new Set(anns.map((a) => a.author))];
      return `<table class="info">
      <tr><td>Exported</td><td>${esc(fmt(d.exported))}</td></tr>
      <tr><td>Last change</td><td>${esc(fmt(d.updated))}</td></tr>
      <tr><td>From</td><td>${esc(d.origin === "server" ? "deciwa serve" : d.origin === "browser" ? "a browser (offline)" : "\u2013")}</td></tr>
      <tr><td>Entries</td><td>${anns.length} in ${files.length} sources</td></tr>
      <tr><td>Authors</td><td>${esc(authors.join(", ") || "\u2013")}</td></tr></table>
      ${files.length ? `<div class="srcs">${files.map(([src, l]) => `<div><span class="mono">${esc(src)}</span><b>${l.length}</b></div>`).join("")}</div>` : ""}`;
    }
    function filesBody() {
      const here = mode === "offline" ? `<div class="hint">Offline \u2013 ${Offline.count()} entries are kept in this browser (last change ${esc(fmt(Offline.updated()))}).</div>` : `<div class="synced">\u2713 Everything is saved on the server \u2013 nothing to sync.</div>`;
      let html = `<h4>Export</h4>${here}
      <div class="row"><button class="btn primary" data-files="export">Export deciwa file</button><button class="btn" data-files="show">Show</button>
      ${mode === "offline" ? `<button class="btn" data-files="reset">Reset</button>` : ""}</div>
      <h4>Import</h4>
      <label class="drop"><input type="file" accept=".json,application/json" data-files="pick"><span>${picked ? esc(picked.name) : "Choose a deciwa file \u2026"}</span></label>`;
      if (picked) {
        const mine = mode === "offline" ? Offline.updated() : null;
        const older = mine && (!picked.data.updated || picked.data.updated < mine);
        html += fileInfo(picked.data) + (older ? `<div class="warnbox">This file is older than the data in this browser (${esc(fmt(mine))}).</div>` : "") + `<div class="row"><button class="btn fill" style="--c:var(--change)" data-files="load">Replace ${mode === "offline" ? "browser" : "server"} data</button>
         <button class="btn" data-files="cancel">Cancel</button></div>
         <div class="hint">No merge \u2013 the file replaces all review data.</div>`;
      }
      return html;
    }
    const exportData = async () => mode === "offline" ? Offline.exportData() : api("/api/export");
    async function showFile() {
      try {
        const data = await exportData();
        const m = $(".dwr-modal");
        m.querySelector(".tbar b").textContent = `${Object.values(data.files).reduce((n, l) => n + l.length, 0)} entries \xB7 ${Object.keys(data.files).length} sources`;
        m.querySelector("pre").textContent = JSON.stringify(data, null, 2);
        m.classList.add("on");
      } catch (err) {
        toast(err.message);
      }
    }
    const closeModal = () => $(".dwr-modal").classList.remove("on");
    $(".dwr-modal .x").onclick = closeModal;
    $(".dwr-modal").onclick = (ev) => {
      if (ev.target === ev.currentTarget) closeModal();
    };
    $(".dwr-modal [data-copy]").onclick = async () => {
      try {
        await navigator.clipboard.writeText($(".dwr-modal pre").textContent);
        toast("Copied");
      } catch (_) {
        toast("Copy not allowed here");
      }
    };
    async function download() {
      try {
        const data = await exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `deciwa-review-${(data.exported || "").replace(/[:]/g, "").slice(0, 15)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
      } catch (err) {
        toast(err.message);
      }
    }
    function wireFiles() {
      panel.querySelectorAll("[data-files]").forEach((el) => {
        const what = el.dataset.files;
        if (what === "pick") el.onchange = async () => {
          const f = el.files[0];
          if (!f) return;
          try {
            picked = { name: f.name, data: JSON.parse(await f.text()) };
            if (!picked.data.files) throw new Error();
          } catch (_) {
            picked = null;
            toast("Not a deciwa file");
          }
          drawPanel();
        };
        else el.onclick = async () => {
          if (what === "export") return download();
          if (what === "show") return showFile();
          if (what === "cancel") {
            picked = null;
            return drawPanel();
          }
          if (what === "reset") {
            if (!el.dataset.armed) {
              el.dataset.armed = "1";
              el.textContent = "Reset \u2013 sure?";
              return;
            }
            Offline.reset();
            toast("Offline review reset");
            return refresh();
          }
          if (what === "load") {
            if (!el.dataset.armed) {
              el.dataset.armed = "1";
              el.textContent = "Replace \u2013 sure?";
              return;
            }
            try {
              const r = mode === "offline" ? Offline.importData(picked.data) : await api("/api/import", { data: picked.data });
              toast(`Loaded ${r.annotations} entries`);
              picked = null;
              refresh();
            } catch (err) {
              toast(err.message);
              drawPanel();
            }
          }
        };
      });
    }
    const buildLine = () => [define_BUILD_default.version, define_BUILD_default.commit && define_BUILD_default.commit + (define_BUILD_default.dirty ? "+" : ""), define_BUILD_default.date].filter(Boolean).join(" \xB7 ");
    const HELP_KEYS = [
      ["Shift R", "review mode on/off"],
      ["Shift P", "panel on/off"],
      ["a r f d", "approve \xB7 reject \xB7 freeze \xB7 delete"],
      ["0\u20135", "stars"],
      ["n", "write a comment"],
      ["v", "guided review"],
      ["j k", "next / previous element"],
      ["Alt click", "the enclosing element"],
      ["Ctrl click", "follow a link"],
      ["Esc", "close the card"],
      ["F1", "this help"]
    ];
    const HELP_LINKS = [
      ["Docs", "https://deciwa.danwos.dev"],
      ["danwos.dev", "https://danwos.dev"],
      ["LinkedIn", "https://www.linkedin.com/in/daniel-woste-362b6252"]
    ];
    function helpBody() {
      return `<div class="about"><img src="${MONSTER}" alt=""><div><b>deciwa</b><span>decision watcher</span></div></div>
      <p>Point at an element of a doc or website and give feedback, rate it or decide on it. deciwa keeps that tied to exactly that element, notices when it changes and shows what is confirmed, open or frozen.</p>
      <h4>Keys</h4>
      <dl class="helpkeys">${HELP_KEYS.map(([k, v]) => `<dt>${k.split(" ").map((c) => `<kbd>${esc(c)}</kbd>`).join(" ")}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <h4>Version</h4><p class="mono">${esc(buildLine())}</p>
      <h4>Author</h4><p>Daniel Woste \xB7 danwos</p>
      <p class="links">${HELP_LINKS.map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${l} \u2197</a>`).join("")}</p>`;
    }
    function showHelp() {
      panelTab = "help";
      if (!panel.classList.contains("on")) togglePanel();
      else {
        savePanelPrefs();
        drawPanel();
      }
    }
    async function drawPanel() {
      const tab = panelTab;
      const body = tab === "project" ? await projectBody() : tab === "files" ? filesBody() : tab === "help" ? helpBody() : pageBody();
      if (tab !== panelTab) return;
      const openDetails = [...panel.querySelectorAll("details[data-k]")].filter((d) => d.open).map((d) => d.dataset.k);
      const offline = mode === "offline" && tab !== "files" && tab !== "help" ? `<div class="offline"><span class="chip off">offline</span>
        <span class="hint">${Offline.count()} entries in this browser</span>
        <button class="btn" data-tab="files">Im/Export</button></div>` : "";
      panel.innerHTML = `<div class="tbar"><img class="logo" src="${MONSTER}" alt=""><div class="kind">deciwa</div>
        <b>${tab === "project" ? "Whole project" : tab === "files" ? "Import and export" : tab === "help" ? "Help" : esc(PAGE.title || document.title.split(" - ")[0])}</b>
        ${docked ? "" : `<button class="x" title="Close (Shift+P)">\xD7</button>`}
        <div class="tabs"><button data-tab="page" class="${tab === "page" ? "on" : ""}">This page</button><button data-tab="project" class="${tab === "project" ? "on" : ""}">Project</button><button data-tab="files" class="${tab === "files" ? "on" : ""}">Im/Export</button><button data-tab="help" class="help ${tab === "help" ? "on" : ""}" title="Help (F1)" aria-label="Help">?</button></div></div>
      <div class="inner">${offline}${body}</div>`;
      if (tab === "files") wireFiles();
      panel.querySelector("[data-guided]")?.addEventListener("click", () => setGuided(!guided));
      panel.querySelectorAll("details").forEach((d, n) => {
        d.dataset.k = d.classList.contains("rules") ? "rules" : "pg" + n;
      });
      panel.querySelectorAll("details[data-k]").forEach((d) => {
        if (openDetails.includes(d.dataset.k) && d.dataset.k === "rules") d.open = true;
      });
      if (!docked) panel.querySelector(".x").onclick = togglePanel;
      panel.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => {
        panelTab = b.dataset.tab;
        savePanelPrefs();
        drawPanel();
      });
      panel.querySelectorAll(".kinds input").forEach((cb) => cb.onchange = async () => {
        const kinds = [...panel.querySelectorAll(".kinds input:checked")].map((i) => i.value);
        try {
          await api("/api/rules", { required: kinds });
          toast("Review rules saved");
          refresh();
        } catch (err) {
          toast(err.message);
        }
      });
      panel.querySelectorAll(".item[data-sel]").forEach((it) => it.onclick = () => {
        if (!docked && innerWidth <= 560 && panel.classList.contains("on")) togglePanel();
        goTo(it.dataset.doc, it.dataset.sel, it.dataset.src);
      });
      if (host.openDoc) panel.querySelectorAll(".quiet a[data-doc]").forEach((a) => a.onclick = (ev) => {
        ev.preventDefault();
        goTo(a.dataset.doc, null, a.dataset.src);
      });
    }
    function diff(a, b) {
      const plain = (t) => String(t).replace(/\*\*|`/g, "");
      const A = plain(a).split(/(\s+)/), B = plain(b).split(/(\s+)/);
      let i = 0;
      while (i < A.length && i < B.length && A[i] === B[i]) i++;
      let j = 0;
      while (j < A.length - i && j < B.length - i && A[A.length - 1 - j] === B[B.length - 1 - j]) j++;
      const ctx = 10;
      const pre = A.slice(Math.max(0, i - ctx), i).join(""), post = A.slice(A.length - j, A.length - j + ctx).join("");
      const del = A.slice(i, A.length - j).join(""), add = B.slice(i, B.length - j).join("");
      return `<div class="diff">${i > ctx ? "\u2026 " : ""}${esc(pre)}${del ? `<span class="del">${esc(del)}</span>` : ""}${add ? `<span class="add">${esc(add)}</span>` : ""}${esc(post)}${A.length - j + ctx < A.length ? " \u2026" : ""}</div>`;
    }
    function histItem(a) {
      const what = a.kind === "rating" ? `${"\u2605".repeat(a.stars)}${"\u2606".repeat(5 - a.stars)}` : a.kind === "request" ? "Question" : LABELS[a.verdict] || a.verdict;
      const c = a.kind === "rating" ? "rated" : a.kind === "request" ? "requested" : COLORS[a.verdict] || "note";
      const actions = [];
      actions.push(`<button data-do="delete" data-id="${a.id}">remove</button>`);
      const replies = (a.replies || []).map((r) => `<div class="reply">\u21B3 ${esc(r.author)}: ${esc(r.verdict ? r.verdict + " " : "")}${esc(r.text || "")}</div>`).join("");
      const changed = a.changed && ["approve", "freeze"].includes(a.verdict) ? diff(a.target.snapshot, a.current) : "";
      return `<div class="h" style="--c:${cv(c)}">
      <div class="meta"><b>${esc(what)}</b> \xB7 ${esc(a.author)} \xB7 ${esc(a.created.slice(0, 16).replace("T", " "))} ${actions.join(" ")}</div>
      ${a.comment ? `<div>${esc(a.comment)}</div>` : ""}${a.question ? `<div>? ${esc(a.question)}</div>` : ""}
      ${a.target.selectors.some((s) => s.type === "TextQuoteSelector") ? `<div class="quote">\u201C${esc(a.target.snapshot)}\u201D</div>` : ""}
      ${changed}${replies}</div>`;
    }
    function openCard(e, reposition = true, scroll = true) {
      if (reposition && e !== current) card.classList.remove("moved");
      const keepText = !reposition && current === e ? card.querySelector("textarea")?.value : "";
      current = e;
      const st = view.elements[e.selector] || { state: "unreviewed", annotations: [] };
      const anns = st.annotations || [];
      const asks = anns.filter((a) => a.kind === "request" && a.status === "open");
      const rated = st.stars ?? null;
      card.querySelector(".body").innerHTML = `
      <div class="tbar"><div class="kind">${esc(e.kind)} <span class="pill" style="--c:${cv(STATE_C[st.state])}">${esc(st.state)}</span>${isRequired(e.selector) ? `<span class="pill req" title="Must be approved (review rules)">must be approved</span>` : ""}</div>
        <b>${esc(e.label)}</b><div class="sel" title="${esc(e.selector)}">${esc(e.selector)}</div>
        <button class="x" title="Close (Esc)">\xD7</button></div>
      <div class="dwr-form">
      ${quote ? `<div class="quote">Selection: \u201C${esc(quote.exact)}\u201D</div>` : ""}
      ${asks.map((a) => `<div class="ask" data-id="${a.id}"><div class="q"><b>${esc(a.author)} asks:</b> ${esc(a.question)}</div>
        <div class="row"><button class="btn fill" style="--c:var(--approved)" data-ans="approve">\u2713 Yes</button><button class="btn fill" style="--c:var(--rejected)" data-ans="reject">\u2717 No</button></div>
        <div class="row"><input placeholder="\u2026 or answer in words"><button class="btn primary" data-ans="text">Send</button></div></div>`).join("")}
      <div class="sec"><label>Verdict <kbd>n</kbd></label>
        <textarea placeholder="Write an optional comment \u2026"></textarea>
        <div class="acts">${Object.entries(ACTS).map(([v, a]) => `<button class="btn fill" data-v="${v}" style="--c:${cv(a.c)}" title="${esc(a.tip)}"><span class="ico">${a.ico}</span>${a.label}<kbd>${a.key}</kbd></button>`).join("")}
          <button class="btn fill note" data-send style="--c:var(--note)" title="Save the comment without a verdict (Ctrl+Enter)"><span class="ico">\u{1F4AC}</span>Comment only<kbd>\u2303\u21B5</kbd></button></div></div>
      <div class="sec"><label>Quality <kbd>0\u20135</kbd></label>
        <div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${rated !== null && n <= rated ? "on" : ""}" title="${n} (key ${n})">\u2605</button>`).join("")}
          ${rated !== null ? `<span class="val">${rated}/5</span>` : ""}</div></div>
      ${mode === "offline" ? `<div class="foot"><span class="chip off" title="No server \u2013 the review is kept in this browser">offline</span></div>` : ""}
      ${anns.length ? `<div class="hist">${anns.slice().reverse().map(histItem).join("")}</div>` : ""}
    </div>`;
      if (keepText) card.querySelector("textarea").value = keepText;
      card.classList.add("on");
      placeCard(e, reposition && scroll);
      place(focusBox, e.node);
      wireCard();
    }
    function placeCard(e, scroll) {
      if (card.classList.contains("moved")) return;
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
      if (scroll) {
        const cr = card.getBoundingClientRect();
        if (cr.bottom > f.bottom - 70) scrollView({ top: cr.bottom - f.bottom + 80, behavior: "smooth" });
        else if (cr.top < f.top + 8) scrollView({ top: cr.top - f.top - 16, behavior: "smooth" });
      }
    }
    card.addEventListener("pointerdown", (ev) => {
      const bar = ev.target.closest(".tbar");
      if (!bar || ev.target.closest("button") || ev.button !== 0) return;
      ev.preventDefault();
      const startX = ev.clientX, startY = ev.clientY;
      const left0 = parseFloat(card.style.left) || 0, top0 = parseFloat(card.style.top) || 0;
      card.classList.add("dragging");
      bar.setPointerCapture(ev.pointerId);
      const move = (m) => {
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
    function closeCard() {
      card.classList.remove("on", "moved");
      focusBox.style.display = "none";
      current = null;
      quote = null;
    }
    function act(verdict) {
      const text = card.querySelector("textarea")?.value.trim() || "";
      if (verdict === "note" && !text) {
        card.querySelector("textarea").focus();
        return toast("Write a comment first");
      }
      save("feedback", { verdict, ...text ? { comment: text } : {} });
    }
    function wireCard() {
      card.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => act(b.dataset.v));
      card.querySelector("[data-send]").onclick = () => act("note");
      card.querySelector(".tbar .x").onclick = closeCard;
      card.querySelectorAll("[data-star]").forEach((b) => b.onclick = () => save("rating", { stars: +b.dataset.star }));
      card.querySelectorAll(".ask").forEach((box) => box.querySelectorAll("[data-ans]").forEach((b) => b.onclick = async () => {
        const kind = b.dataset.ans, text = box.querySelector("input").value.trim();
        if (kind === "text" && !text) return toast("Type an answer first");
        await api("/api/reply", { id: box.dataset.id, text, verdict: kind === "text" ? null : kind, status: "resolved" });
        toast("Answer saved");
        refresh();
      }));
      card.querySelectorAll("[data-do]").forEach((b) => b.onclick = async () => {
        const id = b.dataset.id, what = b.dataset.do;
        if (what === "resolve") await api("/api/reply", { id, status: "resolved", text: "done" });
        if (what === "delete") {
          await api("/api/delete", { id });
          toast("Removed");
        }
        refresh();
      });
      card.querySelector("textarea").onkeydown = (ev) => {
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          act("note");
        }
      };
    }
    function selectionQuote(e) {
      const s = getSelection();
      if (!s || s.isCollapsed) return null;
      const exact = s.toString().replace(/\s+/g, " ").trim();
      if (!exact || !e.node.contains(s.anchorNode)) return null;
      const all = e.node.textContent.replace(/\s+/g, " ");
      const i = all.indexOf(exact);
      return {
        exact,
        prefix: i > 0 ? all.slice(Math.max(0, i - 24), i) : "",
        suffix: i >= 0 ? all.slice(i + exact.length, i + exact.length + 24) : ""
      };
    }
    let blockClick = false;
    function linkedElement(ev, link, up) {
      const e = elementAt(ev.target, up);
      if (e && link.contains(e.node)) return e;
      const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => !link.contains(n));
      const u = under && elementAt(under, up);
      return u && !u.node.contains(link) ? u : null;
    }
    const pick = (ev, link, up) => link && linkedElement(ev, link, up) || elementAt(ev.target, up);
    on(document, "mousedown", () => {
      blockClick = false;
    }, true);
    on(document, "click", (ev) => {
      if (blockClick) {
        ev.preventDefault();
        ev.stopPropagation();
        blockClick = false;
      }
    }, true);
    on(document, "mousemove", (ev) => {
      if (!reviewOn || inUI(ev)) return;
      const e = pick(ev, ev.target.closest("a[href]"), ev.altKey ? 1 : 0);
      hovered = e;
      if (!e) {
        hoverBox.style.display = "none";
        return;
      }
      place(hoverBox, e.node);
      hoverBox.querySelector(".tag").textContent = e.selector;
    });
    on(document, "mouseup", (ev) => {
      if (!reviewOn || inUI(ev) || ev.button !== 0) return;
      if (ev.target.closest(".needs_collapse")) return;
      const link = ev.target.closest("a[href]");
      if (link && (ev.ctrlKey || ev.metaKey)) return;
      const e = pick(ev, link, ev.altKey ? 1 : 0);
      if (!e) {
        if (current && !link) closeCard();
        return;
      }
      if (link) blockClick = true;
      quote = selectionQuote(e);
      if (!quote && getSelection() && !getSelection().isCollapsed) return;
      openCard(e);
    });
    on(document, "keydown", (ev) => {
      const t0 = ev.composedPath()[0];
      const typing = t0.closest && t0.closest("textarea, input, select, [contenteditable]");
      const mine = () => {
        ev.preventDefault();
        if (hostKeys) ev.stopPropagation();
      };
      if (ev.key === "Escape") {
        closeModal();
        closeCard();
        return;
      }
      if (hostKeys && !reviewOn) return;
      if (ev.key === "F1") {
        if (hostKeys) return;
        ev.preventDefault();
        showHelp();
        return;
      }
      if (typing) return;
      if (ev.shiftKey && ev.key === "R") {
        if (hostKeys) return;
        toggleReview();
        return;
      }
      if (ev.shiftKey && ev.key === "P") {
        if (hostKeys) return;
        togglePanel();
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
      if (ev.key === "v") {
        mine();
        setGuided(!guided);
        return;
      }
      if (!reviewOn) return;
      if (ev.key === "j" || ev.key === "k") {
        mine();
        guideStep(ev.key === "j" ? 1 : -1);
        return;
      }
      const target = current || hovered;
      if (!target) return;
      if (KEY2ACT[ev.key]) {
        mine();
        ev.stopPropagation();
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
      if (!reviewOn) {
        hoverBox.style.display = "none";
        closeCard();
      }
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
    $('[data-t="review"]').onclick = (ev) => {
      ev.currentTarget.blur();
      $(".dwr-tools").classList.remove("peek");
      toggleReview();
    };
    $('[data-t="panel"]').onclick = (ev) => {
      ev.currentTarget.blur();
      $(".dwr-tools").classList.remove("peek");
      togglePanel();
    };
    let layoutQueued = false;
    function relayout() {
      if (layoutQueued) return;
      layoutQueued = true;
      requestAnimationFrame(() => {
        layoutQueued = false;
        drawBars();
        if (current) {
          place(focusBox, current.node);
          placeCard(current, false);
        }
        if (hovered && hoverBox.style.display === "block") place(hoverBox, hovered.node);
      });
    }
    on(window, "resize", relayout);
    const ro = "ResizeObserver" in window ? new ResizeObserver(relayout) : null;
    function observe() {
      ro?.observe(document.body);
      for (const e of els) ro?.observe(e.node);
      (host.article() || document).querySelectorAll("img").forEach((img) => img.complete || img.addEventListener("load", relayout, { once: true }));
    }
    observe();
    document.fonts?.ready.then(relayout);
    const SCROLL_KEY = "deciwa-scroll:" + location.pathname;
    try {
      const y = host.api ? null : sessionStorage.getItem(SCROLL_KEY);
      if (y !== null) {
        sessionStorage.removeItem(SCROLL_KEY);
        on(window, "load", () => scrollTo(0, +y));
      }
    } catch (_) {
    }
    let pollTimer = null;
    async function poll() {
      if (destroyed) return;
      try {
        const v = await (await fetch("/api/version", { cache: "no-store" })).json();
        if (version !== null && v.version !== version && !v.building) {
          try {
            sessionStorage.setItem(SCROLL_KEY, String(scrollY));
          } catch (_) {
          }
          location.reload();
          return;
        }
        if (!v.building) version = v.version;
      } catch (_) {
      }
      pollTimer = setTimeout(poll, 1500);
    }
    applyReview();
    if (panelPrefs.open) {
      panel.classList.add("on");
      $('[data-t="panel"]').classList.add("on");
    }
    updateTools();
    refresh().then(() => {
      if (destroyed) return;
      if (online && mode === "server" && !host.api) poll();
      const m = host.focus ? null : location.hash.match(/^#deciwa=(.+)$/);
      if (m) history.replaceState(null, "", location.pathname + location.search);
      const focus = host.focus || m && decodeURIComponent(m[1]);
      if (focus) goTo(null, focus);
      else if (guided && reviewOn) guideStep(1);
    });
    on(window, "load", relayout);
    function update(list, page) {
      if (page) PAGE = page;
      const keep = current && list.find((e) => e.selector === current.selector && e.node);
      if (current && !keep) closeCard();
      hovered = null;
      hoverBox.style.display = "none";
      setElements(list);
      if (keep) current = keep;
      observe();
      refresh();
    }
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
    function setReview(on_) {
      if (on_ !== reviewOn) toggleReview();
    }
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
    return {
      update,
      refresh,
      destroy,
      dock,
      undock,
      setReview,
      toggleReview,
      focus: (sel) => goTo(null, sel),
      get review() {
        return reviewOn;
      }
    };
  }

  // js/sphinx.js
  var pageData = document.getElementById("deciwa-page");
  if (pageData) {
    const PAGE = JSON.parse(pageData.textContent);
    const DOC_BASE = location.pathname.endsWith(PAGE.doc + ".html") ? location.pathname.slice(0, -(PAGE.doc + ".html").length) : "/";
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
      if (window.DECIWA_DATA) return window.DECIWA_DATA;
      const get = async (f) => {
        const r = await fetch(DOC_BASE + "_deciwa/" + f, { cache: "no-store" });
        if (!r.ok) throw new Error(f);
        return r.json();
      };
      const [elements2, annotations, config] = await Promise.all([
        get("elements.json"),
        get("annotations.json").catch(() => ({ files: {} })),
        get("config.json").catch(() => ({ review: { required: [], paths: [] } }))
      ]);
      return { elements: elements2, annotations, config };
    }
    startOverlay({
      page: PAGE,
      elements,
      mount: document.body,
      monster: (document.currentScript?.src || "").replace(/deciwa-overlay\.js.*$/, "deciwa-monster.webp"),
      article: () => document.querySelector("article"),
      docUrl: (doc) => `${DOC_BASE}${doc}.html`,
      storageKey: "deciwa-offline:" + DOC_BASE,
      loadData,
      exportPages: false
    });
  }
})();
