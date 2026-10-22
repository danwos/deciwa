/* The parts of monsterbrain's extension interface v0 this extension uses
 * (monsterbrain: src/shared/extensions.ts, docs/extensions.md). */

export type Disposer = () => void;

export interface HostContext {
  api: number;
  id: string;
  path: string;
  options: Record<string, unknown>;
  root(): string | null;
  onRoot(cb: (root: string | null) => void | Promise<void>): Disposer;
  handle(method: string, fn: (...args: unknown[]) => unknown, opts?: { frames?: boolean }): void;
  emit(event: string, data?: unknown): void;
  decorate(map: Record<string, { badge?: string; color?: string; title?: string }> | null): void;
  tool(t: {
    name: string;
    title?: string;
    description: string;
    params?: Record<string, { type: "string" | "number" | "boolean"; description?: string; optional?: boolean }>;
    readOnly?: boolean;
    run(args: Record<string, unknown>): unknown;
  }): void;
  open(path: string, opts?: { tab?: "view" | "source" | "diff"; highlight?: string; newTab?: boolean }): Promise<unknown>;
  /** the concepts a file belongs to – its own concept folder first, then those listing it under results: */
  concepts(path: string): Promise<Concept[]>;
  /** hand a request to the Claude session of the open folder (only on a click of the user) */
  agent(req: { action: string; prompt: string; meta?: Record<string, string> }): Promise<{ sent: boolean; session?: string; started?: boolean }>;
  log(...args: unknown[]): void;
}

/** A brain concept as monsterbrain knows it (10_concepts/<folder>/concept.md). */
export interface Concept {
  folder: string;
  title: string;
  open: boolean;
  status?: string;
  results: { raw: string; path?: string; abs?: string; exists: boolean; dir: boolean }[];
}

/** What "Inform Claude" covers for a file. */
export interface ReviewScope {
  kind: "concept" | "file";
  /** the concept's title, or the file */
  title: string;
  /** files and folders, relative to the open folder */
  paths: string[];
  /** review entries newer than the last hand-over (kept while monsterbrain runs) */
  active: boolean;
}

/** A rendered view monsterbrain offers. */
export interface ViewContext {
  path: string;
  kind: string;
  role: "view" | "diff" | "before";
  rev?: string;
  /** "tree": JSON and YAML as a tree, every node marked with data-pointer */
  mode: "rendered" | "lines" | "tree";
  element: HTMLElement;
  scroller: HTMLElement;
  /** tree views: open the collapsed nodes around a node so it is visible */
  reveal?(node: Element): void;
}

export interface Channel {
  call(method: string, ...args: unknown[]): Promise<unknown>;
  on(event: string, cb: (data: unknown) => void): () => void;
}

export interface Contribution {
  mountView?(v: ViewContext): void | (() => void);
  panel?: { title: string; mount(el: HTMLElement, p: { path: string | null; kind?: string }): void | (() => void) };
  toolbar?: { mount(el: HTMLElement, p: { path: string | null; kind?: string }): void | (() => void) };
  commands?: { id: string; title: string; key?: string; run?: () => void }[];
}

declare global {
  interface Window {
    mbx: {
      api: number;
      register(id: string, c: Contribution): Channel;
      /* inside rendered HTML pages */
      frame?: boolean;
      path?: string;
      call?(ext: string, method: string, ...args: unknown[]): Promise<unknown>;
      on?(ext: string, event: string, cb: (data: unknown) => void): () => void;
    };
  }
}

/** Engine state for the open folder. */
export interface Status {
  state: "off" | "starting" | "ready" | "no-deciwa" | "not-found" | "error";
  message?: string;
  engine?: string;
  engineRoot?: string;
  prefix?: string;
}
