/* deciwa client for host apps (PROP_CLIENT_PACKAGE): finds the engine, starts
 * it with `serve --api-only` for one folder, checks its API version, restarts
 * it after a crash and calls the JSON API. No logic of its own – everything
 * is decided by the engine (DEC_CLI_MASTER). Runs in Node (a host's main or
 * extension process), never in a web page: the token stays here. */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";

/** Major version of the engine's JSON API this client speaks. */
export const API_MAJOR = 1;

export type ErrorCode = "not-found" | "no-deciwa" | "api-mismatch" | "start-failed" | "stopped" | "request";

export class EngineError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
  }
}

/** The line the engine prints on start. */
export interface Handshake {
  deciwa: string;
  api: number;
  port: number;
  token: string;
  /** the folder that holds .deciwa/ – may be above the folder the host opened */
  root: string;
}

export interface EngineOptions {
  /** folder the host opened; the engine looks for .deciwa/ here and above */
  root: string;
  /** engine path from the host's settings – tried first */
  enginePath?: string;
  /** engines shipped with the host (or a development checkout) – tried next, before PATH */
  bundled?: string[];
  /** start again after a crash (default true) */
  restart?: boolean;
  /** stderr lines of the engine, and the client's own notes */
  log?: (line: string) => void;
  /** the engine is (again) ready – after start and after every restart */
  onReady?: (h: Handshake) => void;
  /** the engine stopped for good (not by stop()) */
  onFail?: (e: EngineError) => void;
}

// -- finding the engine -------------------------------------------------------

const EXE = process.platform === "win32" ? ["deciwa.exe", "deciwa.cmd", "deciwa"] : ["deciwa"];

function runnable(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The engine to start: the configured path, a bundled one, then `deciwa` on PATH. */
export function findEngine(opts: { enginePath?: string; bundled?: string[] } = {}): string | null {
  for (const p of [opts.enginePath, ...(opts.bundled ?? [])]) if (p && runnable(p)) return p;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const name of EXE) if (runnable(join(dir, name))) return join(dir, name);
  }
  return null;
}

/** `deciwa init --at <folder>`: start reviewing a folder. */
export function initFolder(engine: string, folder: string): Promise<void> {
  return new Promise((resolve, reject) =>
    execFile(engine, ["init", "--at", folder], (err, _out, stderr) =>
      err ? reject(new EngineError("start-failed", stderr.trim() || err.message)) : resolve()
    )
  );
}

// -- types of the JSON API ------------------------------------------------------

export interface Element {
  key?: string;
  selector: string;
  kind: string;
  label: string;
  line?: number | null;
  end?: number;
  text?: string;
  fingerprint?: string;
  parent?: string | null;
}

export interface Annotation {
  id: string;
  kind: "feedback" | "rating" | "request";
  verdict?: string;
  stars?: number;
  comment?: string;
  question?: string;
  to?: string[];
  author: string;
  created: string;
  status: "open" | "resolved";
  target: { selectors: { type: string; value?: string; exact?: string }[]; fingerprint: string; snapshot: string };
  replies: { author: string; created: string; text?: string; verdict?: string }[];
  changed?: boolean;
  element?: string;
  current?: string;
}

export interface ElementState {
  state: string;
  requested: boolean;
  stars: number | null;
  annotations: Annotation[];
}

export interface PageView {
  source: string;
  elements: Record<string, ElementState>;
  orphans: Annotation[];
  required: string[];
  rules: { required: string[]; paths: string[] };
}

export interface FileSummary {
  states: Record<string, number>;
  questions: number;
  jobs: number;
  required: number;
  done: number;
  decided: number;
  annotations: number;
}

export interface ChangeEvent {
  type: "changed";
  sources: string[];
  config: boolean;
  review: boolean;
}

export interface Job {
  job: string;
  id: string;
  source: string;
  line?: number | null;
  element: string;
  verdict?: string;
  question?: string;
  comment?: string;
  quote?: string;
  current?: string;
  author?: string;
  state?: string;
}

// -- the engine ------------------------------------------------------------------

export class Engine {
  readonly opts: EngineOptions;
  readonly path: string;
  private child: ChildProcess | null = null;
  private hs: Handshake | null = null;
  private starting: Promise<Handshake> | null = null;
  private stopped = false;
  private crashes: number[] = [];

  constructor(opts: EngineOptions) {
    this.opts = opts;
    const path = findEngine(opts);
    if (!path) throw new EngineError("not-found", "deciwa engine not found – set its path or put `deciwa` on PATH");
    this.path = path;
  }

  /** The handshake of the running engine, or null. */
  get handshake(): Handshake | null {
    return this.hs;
  }

  /** Start the engine (once) and wait for its handshake. */
  start(): Promise<Handshake> {
    if (this.hs) return Promise.resolve(this.hs);
    if (!this.starting) this.starting = this.launch().finally(() => (this.starting = null));
    return this.starting;
  }

  private launch(): Promise<Handshake> {
    this.stopped = false;
    const log = this.opts.log ?? (() => {});
    return new Promise((resolve, reject) => {
      const child = spawn(this.path, ["serve", "--api-only", "--root", this.opts.root, "--port", "0"], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      this.child = child;
      let out = "";
      let settled = false;
      const fail = (e: EngineError): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      };
      const timer = setTimeout(() => {
        fail(new EngineError("start-failed", "the engine did not answer within 20 s"));
        child.kill();
      }, 20000);
      child.on("error", (err) => fail(new EngineError("start-failed", err.message)));
      child.stderr!.setEncoding("utf8").on("data", (d: string) => d.split("\n").filter(Boolean).forEach(log));
      child.stdout!.setEncoding("utf8").on("data", (d: string) => {
        if (settled) return;
        out += d;
        const nl = out.indexOf("\n");
        if (nl < 0) return;
        let msg: Handshake & { error?: { code: string; message: string } };
        try {
          msg = JSON.parse(out.slice(0, nl));
        } catch {
          return fail(new EngineError("start-failed", `unexpected engine output: ${out.slice(0, 200)}`));
        }
        if (msg.error) return fail(new EngineError(msg.error.code === "no-deciwa" ? "no-deciwa" : "start-failed", msg.error.message));
        if (msg.api !== API_MAJOR) {
          child.kill();
          return fail(new EngineError("api-mismatch",
            `the engine ${msg.deciwa} speaks API ${msg.api}, this host needs API ${API_MAJOR} – update the deciwa engine or the host`));
        }
        settled = true;
        clearTimeout(timer);
        this.hs = msg;
        log(`deciwa engine ${msg.deciwa} for ${msg.root} on port ${msg.port}`);
        this.opts.onReady?.(msg);
        resolve(msg);
      });
      child.on("exit", (code, signal) => {
        const was = this.hs;
        if (this.child === child) {
          this.child = null;
          this.hs = null;
        }
        fail(new EngineError("start-failed", `the engine exited (${signal ?? code})`));
        if (this.stopped || !was) return;
        log(`deciwa engine exited (${signal ?? code})`);
        this.crashed();
      });
    });
  }

  private crashed(): void {
    const now = Date.now();
    this.crashes = [...this.crashes.filter((t) => now - t < 60000), now];
    if (this.opts.restart === false || this.crashes.length > 3) {
      this.opts.onFail?.(new EngineError("stopped", "the deciwa engine stopped and was not started again"));
      return;
    }
    setTimeout(() => {
      if (!this.stopped) this.start().catch((e) => this.opts.onFail?.(e));
    }, 1000);
  }

  /** Stop the engine: closing stdin ends it; killed if it is still there after 2 s. */
  async stop(): Promise<void> {
    this.stopped = true;
    const child = this.child;
    this.child = null;
    this.hs = null;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 2000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      child.stdin?.end();
    });
  }

  // -- requests ------------------------------------------------------------------

  /** The running engine for a request; never starts one again after stop(). */
  private ready(): Promise<Handshake> {
    if (this.stopped) return Promise.reject(new EngineError("stopped", "the deciwa engine was stopped"));
    return this.start();
  }

  /** Any API call: GET without a body, POST with one. Returns the `result`. */
  async call<T = unknown>(path: string, body?: unknown): Promise<T> {
    const hs = await this.ready();
    const res = await fetch(`http://127.0.0.1:${hs.port}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-Deciwa-Token": hs.token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; result?: T; error?: string };
    if (!data.ok) throw new EngineError("request", data.error ?? `HTTP ${res.status}`);
    return data.result as T;
  }

  async version(): Promise<{ app: string; api: number; root: string }> {
    const hs = await this.ready();
    const res = await fetch(`http://127.0.0.1:${hs.port}/api/version`, { headers: { "X-Deciwa-Token": hs.token } });
    return (await res.json()) as { app: string; api: number; root: string };
  }

  elements(source: string): Promise<{ source: string; title?: string; elements: Element[] }> {
    return this.call(`/api/elements?source=${encodeURIComponent(source)}`);
  }

  page(source: string): Promise<PageView> {
    return this.call(`/api/page?source=${encodeURIComponent(source)}`);
  }

  /** Counts per file; without sources for every file that has review data. */
  summary(sources?: string[]): Promise<Record<string, FileSummary>> {
    return this.call(sources ? `/api/summary?sources=${sources.map(encodeURIComponent).join(",")}` : "/api/summary");
  }

  /** Open jobs and questions; with sources only those of these files or folders (root-relative). */
  todo(forAuthor?: string, sources?: string[]): Promise<Job[]> {
    const q = new URLSearchParams();
    if (forAuthor) q.set("for", forAuthor);
    if (sources) q.set("sources", sources.join(","));
    const s = q.toString();
    return this.call(s ? `/api/todo?${s}` : "/api/todo");
  }

  annotate(a: { source: string; selector: string; kind: string; [field: string]: unknown }): Promise<Annotation> {
    return this.call("/api/annotate", a);
  }

  /** Elements a host found in a page it scanned itself (rendered HTML). */
  hostPage(source: string, title: string, elements: Element[]): Promise<{ source: string; elements: number }> {
    return this.call("/api/elements", { source, title, elements });
  }

  /**
   * Change events (server-sent). Reconnects – also to a restarted engine –
   * until the returned function is called.
   */
  events(onEvent: (e: ChangeEvent) => void): () => void {
    let closed = false;
    let ctrl: AbortController | null = null;
    const log = this.opts.log ?? (() => {});
    const loop = async (): Promise<void> => {
      while (!closed && !this.stopped) {
        try {
          const hs = await this.ready();
          ctrl = new AbortController();
          const res = await fetch(`http://127.0.0.1:${hs.port}/api/events`, {
            headers: { "X-Deciwa-Token": hs.token },
            signal: ctrl.signal,
          });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let end: number;
            while ((end = buf.indexOf("\n\n")) >= 0) {
              const chunk = buf.slice(0, end);
              buf = buf.slice(end + 2);
              const data = chunk.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
              if (data) {
                try {
                  onEvent(JSON.parse(data) as ChangeEvent);
                } catch (e) {
                  log(`deciwa event: ${(e as Error).message}`);
                }
              }
            }
          }
        } catch (e) {
          if (closed) return;
          if (this.stopped) return;
          log(`deciwa events: ${(e as Error).message} – reconnecting`);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    void loop();
    return () => {
      closed = true;
      ctrl?.abort();
    };
  }
}
