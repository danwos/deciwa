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
  /** add lines to the prompt of one of monsterbrain's Claude actions (concept_implement, concept_close, task_implement, task_close, message) */
  agentPrompt(action: string, fn: (p: { path: string; concept?: Concept }) => string | null | undefined | Promise<string | null | undefined>): void;
  /** fill the file nodes of a side bar view with children (monsterbrain's facts view) */
  children(view: "facts", provider: {
    list(paths: string[]): Promise<ChildList>;
    select?(path: string, id: string): void | Promise<void>;
    actions?: { id: string; title: string; key?: string; confirm?: string; run(paths: string[]): unknown }[];
  }): void;
  /** monsterbrain asks the providers of the view again */
  childrenChanged(view: "facts"): void;
  log(...args: unknown[]): void;
}

/** Children of file nodes, as monsterbrain's facts view shows them. */
export interface ChildList {
  groups: { id: string; label: string; color: string }[];
  files: Record<string, { id: string; label: string; context?: string; line?: number; group?: string; title?: string }[]>;
  marks?: Record<string, { badge?: string; color?: string; title?: string }>;
}

/** The facts of some files, from the engine (/api/facts). */
export interface FactsResult {
  groups: string[];
  counts: Record<string, number>;
  facts: number;
  files: {
    source: string;
    title: string;
    file: string;
    orphans: number;
    counts: Record<string, number>;
    facts: { selector: string; kind: string; label: string; context: string; line: number | null; state: string;
      group: string; assumption: boolean }[];
  }[];
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
  /** the main entry of monsterbrain's Claude button (split button in the head of the file) */
  claude?: { watch(p: { path: string | null; kind?: string }, set: (e: ClaudeEntry | null) => void): void | (() => void) };
}

/** The main entry of monsterbrain's Claude button. */
export interface ClaudeEntry {
  label: string;
  title?: string;
  enabled: boolean;
  run(): void | Promise<unknown>;
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
