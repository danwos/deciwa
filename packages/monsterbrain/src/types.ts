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
  log(...args: unknown[]): void;
}

/** A rendered view monsterbrain offers. */
export interface ViewContext {
  path: string;
  kind: string;
  role: "view" | "diff" | "before";
  rev?: string;
  mode: "rendered" | "lines";
  element: HTMLElement;
  scroller: HTMLElement;
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
