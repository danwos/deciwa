/* deciwa in monsterbrain – main process part. Starts the engine for the folder
 * monsterbrain has open, relays the window's API calls to it, marks files in
 * the tree with their review state and adds MCP tools. No logic of its own:
 * everything comes from the engine through the client (DEC_HOST_EXTENSIONS). */
import { Engine, EngineError, findEngine, initFolder, type FileSummary, type Handshake } from "@danwos/deciwa-client";
import { join, relative, sep } from "node:path";
import type { HostContext, ReviewScope, Status } from "./types";

let ctx: HostContext;
let engine: Engine | null = null;
let closeEvents: (() => void) | null = null;
let status: Status = { state: "off" };
let root: string | null = null;
let prefix = "";  // the open folder inside the engine's root, e.g. "danwos" – "" when they are the same

/** Engines to try after the configured one: shipped with the extension, then a development checkout. */
const bundled = (): string[] => [
  join(ctx.path, "engine", process.platform === "win32" ? "deciwa.exe" : "deciwa"),
  join(ctx.path, "..", "..", ".venv", process.platform === "win32" ? "Scripts/deciwa.exe" : "bin/deciwa"),
];
const enginePath = (): string | undefined => typeof ctx.options.enginePath === "string" ? ctx.options.enginePath : undefined;

/** Path in the open folder → source in the engine's root, and back. */
const toSource = (path: string): string => (prefix ? `${prefix}/${path}` : path);
const toPath = (source: string): string | null =>
  !prefix ? source : source.startsWith(prefix + "/") ? source.slice(prefix.length + 1) : null;

function setStatus(s: Status): void {
  status = s;
  ctx.emit("status", status);
}

async function stopEngine(): Promise<void> {
  closeEvents?.();
  closeEvents = null;
  const e = engine;
  engine = null;
  await e?.stop();
}

async function startEngine(folder: string | null): Promise<void> {
  await stopEngine();
  root = folder;
  ctx.decorate(null);
  if (!folder) return setStatus({ state: "off" });
  setStatus({ state: "starting" });
  let e: Engine;
  try {
    e = new Engine({
      root: folder,
      enginePath: enginePath(),
      bundled: bundled(),
      log: (line) => ctx.log(line),
      onReady: (h: Handshake) => {
        prefix = relative(h.root, folder).split(sep).join("/");
        setStatus({ state: "ready", engine: h.deciwa, engineRoot: h.root, prefix });
        void decorate();
      },
      onFail: (err) => setStatus({ state: "error", message: err.message }),
    });
  } catch (err) {
    return setStatus({ state: "not-found", message: (err as Error).message });
  }
  engine = e;
  try {
    await e.start();
  } catch (err) {
    if (engine !== e) return;
    engine = null;
    const code = err instanceof EngineError ? err.code : "start-failed";
    return setStatus({ state: code === "no-deciwa" ? "no-deciwa" : "error", message: (err as Error).message });
  }
  if (engine !== e) return;
  closeEvents = e.events((ev) => {
    const paths = ev.sources.map(toPath).filter((p): p is string => p !== null);
    ctx.emit("changed", { ...ev, paths });
    void decorate();
  });
}

// -- decorations: review state per file in the tree and the change view ----------

const COLORS = { requested: "#0F766E", change: "#B4462F", approved: "#4D5E22", open: "#5F5A54", stale: "#8A6A3A" };

function decoration(s: FileSummary): { badge?: string; color?: string; title?: string } | null {
  const parts = Object.entries(s.states).map(([state, n]) => `${n} ${state}`);
  if (s.questions) parts.unshift(`${s.questions} open question${s.questions === 1 ? "" : "s"}`);
  if (s.required) parts.push(`${s.done} of ${s.required} required approved`);
  const title = `deciwa: ${parts.join(" · ")}`;
  if (s.questions) return { badge: `${s.questions}?`, color: COLORS.requested, title };
  if (s.jobs) return { badge: String(s.jobs), color: COLORS.change, title };
  const stale = (s.states["stale"] ?? 0) + (s.states["frozen, but changed"] ?? 0) + (s.states["orphaned"] ?? 0);
  if (stale) return { badge: `${stale}!`, color: COLORS.stale, title };
  if (s.required && s.done < s.required) return { badge: `${s.done}/${s.required}`, color: COLORS.open, title };
  if (s.annotations) return { badge: "✓", color: COLORS.approved, title };
  return null;
}

let decorating = false;
let again = false;
async function decorate(): Promise<void> {
  if (!engine) return;
  if (decorating) {
    again = true;
    return;
  }
  decorating = true;
  try {
    const summary = await engine.summary();
    const map: Record<string, ReturnType<typeof decoration> & object> = {};
    for (const [source, s] of Object.entries(summary)) {
      const path = toPath(source);
      const d = decoration(s);
      if (path !== null && d) map[path] = d;
    }
    ctx.decorate(map);
  } catch (err) {
    ctx.log(`decorations: ${(err as Error).message}`);
  } finally {
    decorating = false;
    if (again) {
      again = false;
      void decorate();
    }
  }
}

// -- Inform Claude ------------------------------------------------------------------
// The button next to the review switch tells the Claude session of the folder about the
// review (monsterbrain's ctx.agent). Scope: the file's open concept when that concept –
// its folder or a file it lists under results: – has review entries newer than the last
// hand-over; else the file alone. No review state of its own: every entry carries its
// `created` time, Claude reads what is newer itself. The time of the last hand-over is
// only kept while monsterbrain runs.

const informedAt = new Map<string, string>();  // scope (its first path) → ISO time of the last hand-over
const stamp = (): string => new Date().toISOString().slice(0, 19) + "Z";  // the engine's format
const under = (source: string, paths: string[]): boolean =>
  paths.some((p) => source === p || source.startsWith(p.replace(/\/+$/, "") + "/"));

/** Sources with review data in these paths, and the newest entry people made there (feedback, rating, question, reply). */
async function reviewed(paths: string[]): Promise<{ sources: string[]; newest: string }> {
  const wanted = paths.map(toSource);
  const sources = Object.keys(await engine!.summary()).filter((s) => under(s, wanted));
  let newest = "";
  for (const source of sources) {
    const view = await engine!.page(source);
    const anns = [...Object.values(view.elements).flatMap((e) => e.annotations), ...view.orphans];
    for (const a of anns)
      for (const e of [a, ...(a.replies ?? [])])
        if (!e.author.startsWith("agent:") && e.created > newest) newest = e.created;
  }
  return { sources, newest };
}

type Scope = ReviewScope & { sources: string[]; since?: string };

async function reviewScope(path: string): Promise<Scope | null> {
  if (!engine) return null;
  const concepts = (await ctx.concepts(path)).filter((c) => c.open);
  // a hand-over of a concept also covers its files
  let since = informedAt.get(path) ?? "";
  for (const c of concepts) {
    const paths = [c.folder, ...c.results.filter((r) => r.path && r.exists).map((r) => r.path!)];
    const told = informedAt.get(c.folder) ?? "";
    if (told > since) since = told;
    const r = await reviewed(paths);
    if (r.newest > told) return { kind: "concept", title: c.title, paths, active: true, sources: r.sources, since: told || undefined };
  }
  const r = await reviewed([path]);
  return { kind: "file", title: path, paths: [path], active: r.newest > since, sources: r.sources, since: since || undefined };
}

function reviewPrompt(s: Scope, exe: string, engineRoot: string): string {
  const cli = `${exe} --root ${engineRoot}`;
  const what = s.kind === "concept" ? `the concept "${s.title}" (${s.paths[0]} and its results)` : s.title;
  return [
    `I reviewed ${what} in deciwa. Stay within that scope.`,
    "",
    `1. Read the review of each file: ${s.sources.map((src) => `\`${cli} --json show ${src}\``).join(", ")}. ` +
      (s.since
        ? `Entries and replies with \`created\` after ${s.since} are new since I last informed you; the rest you know.`
        : "Every entry and reply carries its `created` time – what is newer than what you handled in this session is new."),
    "2. Approvals are confirmation – if you were waiting for one, go on with that work. Read answers to your questions.",
    `3. Open jobs: \`${cli} todo ${s.paths.map((p) => join(root!, p)).join(" ")}\` – apply comments, fix rejected statements, ` +
      "remove elements marked for deletion, restore frozen ones that changed; never touch frozen elements otherwise. " +
      `Mark each done: \`${cli} resolve <id> --note "…" --author agent:claude\`.`,
    `4. Anything unclear: ask at the element – \`${cli} request <file> <element> --to daniel --question "…" --author agent:claude\` – instead of guessing.`,
    "5. Show me the result in monsterbrain (show_changes) and sum up what you did.",
  ].join("\n");
}

// -- activation ---------------------------------------------------------------------

const FRAME_GET = ["/api/page", "/api/project", "/api/elements", "/api/summary"];
const FRAME_POST = ["/api/annotate", "/api/reply", "/api/elements"];

export function activate(c: HostContext): void {
  ctx = c;
  ctx.onRoot((folder) => startEngine(folder));

  ctx.handle("status", () => status, { frames: true });
  ctx.handle("source", (path) => toSource(String(path)), { frames: true });
  ctx.handle("api", async (path, body) => {
    if (!engine) throw new Error("deciwa is not running for this folder");
    return engine.call(String(path), body === null ? undefined : body);
  });
  // rendered HTML pages: any script of the page can call this, so only reading and giving feedback
  ctx.handle("frame-api", async (path, body) => {
    if (!engine) throw new Error("deciwa is not running for this folder");
    const p = String(path);
    const endpoint = p.split("?")[0];
    const allowed = body === null || body === undefined ? FRAME_GET.includes(endpoint) : FRAME_POST.includes(endpoint);
    if (!allowed) throw new Error(`not available in a page: ${endpoint}`);
    return engine.call(p, body === null ? undefined : body);
  }, { frames: true });
  ctx.handle("init", async () => {
    if (!root) throw new Error("no folder open");
    const exe = findEngine({ enginePath: enginePath(), bundled: bundled() });
    if (!exe) throw new Error("deciwa engine not found");
    await initFolder(exe, root);
    await startEngine(root);
    return status;
  });
  // review mode between the window and rendered HTML pages: the window switches it, the page reports it
  ctx.handle("relay", (event, data) => {
    if (event !== "frame-review" && event !== "frame-state") throw new Error(`cannot relay ${event}`);
    ctx.emit(String(event), data);
  }, { frames: true });
  // open the file of a source (another page of the project) and show the element
  ctx.handle("open", async (source, selector) => {
    const path = toPath(String(source));
    if (path === null) throw new Error(`${source} is outside the open folder`);
    await ctx.open(path);
    ctx.emit("focus", { path, selector: selector ?? null });
    return path;
  }, { frames: true });

  ctx.handle("review-scope", async (path): Promise<ReviewScope | null> => {
    const s = await reviewScope(String(path));
    return s && { kind: s.kind, title: s.title, paths: s.paths, active: s.active };
  });
  ctx.handle("review-to-claude", async (path) => {
    const scope = await reviewScope(String(path));
    if (!scope?.active) throw new Error("nothing new for Claude here");
    const exe = findEngine({ enginePath: enginePath(), bundled: bundled() });
    if (!exe || !status.engineRoot) throw new Error("deciwa engine not found");
    const at = stamp();
    const result = await ctx.agent({
      action: "deciwa_review",
      prompt: reviewPrompt(scope, exe, status.engineRoot),
      meta: { scope: scope.kind, path: scope.paths[0] },
    });
    if (result.sent || result.started) {
      informedAt.set(scope.paths[0], at);
      ctx.emit("changed", { type: "changed", sources: [], paths: [] });  // the button greys out
    }
    return result;
  });

  ctx.tool({
    name: "deciwa_feedback",
    title: "Review feedback (deciwa)",
    description:
      "Review state from deciwa. With path: every reviewed element of that file with its state, comments and open " +
      "questions. Without path: the open jobs of the whole folder (what to change, questions to answer) – the same as " +
      "`deciwa todo`. Paths are relative to the folder open in monsterbrain.",
    params: { path: { type: "string", optional: true, description: "file path relative to the open folder" } },
    readOnly: true,
    run: async (args) => {
      if (!engine) throw new Error(`deciwa is not running: ${status.message ?? status.state}`);
      if (typeof args.path === "string" && args.path) {
        const view = await engine.page(toSource(args.path));
        return {
          path: args.path,
          elements: Object.fromEntries(Object.entries(view.elements).map(([sel, st]) => [sel, {
            state: st.state, stars: st.stars,
            annotations: st.annotations.map((a) => ({ id: a.id, kind: a.kind, verdict: a.verdict, comment: a.comment,
              question: a.question, status: a.status, author: a.author, quote: a.target.snapshot })),
          }])),
          orphans: view.orphans.length,
          required: view.required.length,
        };
      }
      const jobs = await engine.todo();
      return jobs.map((j) => ({ ...j, path: toPath(j.source) }));
    },
  });
  ctx.tool({
    name: "deciwa_show",
    title: "Show an element for review (deciwa)",
    description:
      "Opens a file in monsterbrain and points at one element (selector from deciwa_feedback, e.g. " +
      "md:paragraph:Title/Goal#1), so Daniel can review it. Without element only the file opens.",
    params: {
      path: { type: "string", description: "file path relative to the open folder" },
      element: { type: "string", optional: true, description: "deciwa selector of the element" },
    },
    run: async (args) => {
      const path = String(args.path);
      const state = await ctx.open(path);
      ctx.emit("focus", { path, selector: typeof args.element === "string" ? args.element : null });
      return state;
    },
  });
}

export async function deactivate(): Promise<void> {
  await stopEngine();
}
