"""deciwa CLI. Every command can print JSON with --json."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from deciwa.core import Project, store


def _out(args, command: str, result, human=None):
    if args.json:
        print(json.dumps({"deciwa": "0.1", "command": command, "ok": True, "result": result},
                         indent=2, ensure_ascii=False))
    elif human:
        human(result)
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))


def cmd_init(args):
    root = Path(args.at or ".").resolve()
    (root / store.FOLDER / "annotations").mkdir(parents=True, exist_ok=True)
    print(f"created {root / store.FOLDER}")


def cmd_serve(args):
    from deciwa.server import API, Builder, serve, serve_api
    if args.api_only:
        try:
            p = Project()
        except FileNotFoundError as e:  # the host reads this instead of the handshake
            print(json.dumps({"api": API, "error": {"code": "no-deciwa", "message": str(e)}}), flush=True)
            sys.exit(2)
        serve_api(p, port=args.port if args.port is not None else 0, token=args.token,
                  watch_stdin=not args.keep_running)
        return
    p = Project()
    # the build: Sphinx today; other integrations bring their own command
    base = [sys.executable, "-m", "sphinx", "-q", "-b", "html", str(p.docs), str(p.build)]
    watch = [p.docs]
    for module in ("deciwa.ui", "deciwa.sphinx"):  # rebuild when the overlay or extension changes, too
        try:
            watch.append(Path(__import__(module, fromlist=["_"]).__file__).parent)
        except ImportError:
            pass
    serve(p, p.build, Builder(base, base[:3] + ["-E"] + base[3:], watch), port=args.port or 4337)


def cmd_status(args):
    def human(r):
        req = r["required"]
        print(f"{r['elements']} elements · {req['done']} of {req['total']} required approved "
              f"(rules: {', '.join(req['rules']['required']) or 'none'})")
        for state, n in sorted(r["states"].items(), key=lambda x: -x[1]):
            print(f"  {n:4}  {state}")
    _out(args, "status", Project().status(), human)


def cmd_todo(args):
    def human(jobs):
        if not jobs:
            print("nothing to do")
        for j in jobs:
            what = j.get("verdict") or j["job"]
            where = f"{j['source']}:{j.get('line') or '?'}" if not j.get("url") else f"{j['source']} ({j['url']})"
            print(f"{j['id']}  {what:9} {where}  {j['element']}")
            if j.get("question"):
                print(f"          ? {j['question']}")
            if j.get("comment"):
                print(f"          “{j['comment']}”")
    p = Project()
    _out(args, "todo", p.todo(args.for_, [_source(p, x) for x in args.paths] if args.paths else None), human)


def _source(p, path: str) -> str:
    """A path given on the command line → root-relative source; paths that exist from here count from here."""
    here = Path(path).resolve()
    if here.exists() and here.is_relative_to(p.root.resolve()):
        return here.relative_to(p.root.resolve()).as_posix()
    return path.strip("/").removeprefix("./")


def cmd_show(args):
    p = Project()
    _, page = p.page_of_source(p.index(), args.source)
    view = p.view(args.source, page["elements"])

    def human(v):
        for sel, st in v["elements"].items():
            badge = " +request" if st["requested"] else ""
            print(f"{st['state']:20}{badge} {sel}")
            for a in st["annotations"]:
                what = a.get("verdict") or (f"Q{a['stars']}" if a["kind"] == "rating" else a["kind"])
                print(f"    {a['id']}  {what:9} {a['status']:9} {a['author']}  {a.get('comment') or a.get('question') or ''}")
        for o in v["orphans"]:
            print(f"orphaned             {o['target']['selectors'][0]['value']}  ({o['id']})")
    _out(args, "show", view, human)


def cmd_elements(args):
    p = Project()
    _, page = p.page_of_source(p.index(), args.source)

    def human(els):
        for e in els:
            print(f"{e['selector']:50} {e.get('line') or '':>4}  {e['kind']:9} {e['label']}")
    _out(args, "elements", page["elements"], human)


def cmd_annotate(args):
    fields = {k: v for k, v in {"verdict": args.verdict, "comment": args.comment}.items() if v}
    ann = Project().add(args.source, args.element, "feedback", author=args.author, **fields)
    _out(args, "annotate", ann, lambda a: print(a["id"]))


def cmd_rate(args):
    ann = Project().add(args.source, args.element, "rating", author=args.author, stars=args.stars)
    _out(args, "rate", ann, lambda a: print(a["id"]))


def cmd_request(args):
    ann = Project().add(args.source, args.element, "request", author=args.author,
                        question=args.question, to=args.to)
    _out(args, "request", ann, lambda a: print(a["id"]))


def cmd_answer(args):
    ann = Project().reply(args.id, args.text or "", args.verdict, "resolved", author=args.author)
    _out(args, "answer", ann, lambda a: print(f"{a['id']} answered"))


def cmd_resolve(args):
    ann = Project().resolve_job(args.id, args.note or "", author=args.author)
    _out(args, "resolve", ann, lambda a: print(f"{a['id']} resolved"))


def cmd_import(args):
    r = Project().import_file(Path(args.file), force=args.force)

    def human(x):
        print(f"replaced: {x['annotations']} annotations in {x['sources']} sources")
        for f in x.get("mapped", []):
            print(f"  mapped to {f}")
    _out(args, "import", r, human)


def cmd_remap(args):
    def human(moved):
        if not moved:
            print("nothing to move – no [web] rule fits a page kept under its address")
        for m in moved:
            print(f"{m['url']} -> {m['to']}  ({m['annotations']} annotations)")
    _out(args, "remap", Project().remap(), human)


def cmd_export(args):
    data = Project().export()
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if args.file:
        Path(args.file).write_text(text)
        print(f"exported to {args.file}")
    else:
        print(text, end="")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="deciwa", description="deciwa – review and decision tool")
    ap.add_argument("--json", action="store_true", help="print the JSON envelope")
    ap.add_argument("--root", help="start looking for .deciwa/ here instead of the current folder")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init"); s.add_argument("--at"); s.set_defaults(fn=cmd_init)
    s = sub.add_parser("serve", help="review server: the built docs with the JSON API, or the API alone for a host app")
    s.add_argument("--port", type=int, help="default 4337; with --api-only 0 = a free port")
    s.add_argument("--api-only", action="store_true",
                   help="only the JSON API, no build: prints a handshake line, stops when stdin closes")
    s.add_argument("--token", help="with --api-only: the token every request must carry (default: random)")
    s.add_argument("--keep-running", action="store_true", help="with --api-only: do not stop when stdin closes")
    s.add_argument("--root", default=argparse.SUPPRESS, help="the folder to review (also before the command)")
    s.set_defaults(fn=cmd_serve)
    s = sub.add_parser("status"); s.set_defaults(fn=cmd_status)
    s = sub.add_parser("todo", help="open jobs and questions; with paths only those of these files or folders")
    s.add_argument("paths", nargs="*"); s.add_argument("--for", dest="for_"); s.set_defaults(fn=cmd_todo)
    s = sub.add_parser("show"); s.add_argument("source"); s.set_defaults(fn=cmd_show)
    s = sub.add_parser("elements"); s.add_argument("source"); s.set_defaults(fn=cmd_elements)
    for name, fn in (("annotate", cmd_annotate), ("rate", cmd_rate), ("request", cmd_request)):
        s = sub.add_parser(name); s.add_argument("source"); s.add_argument("element")
        s.add_argument("--author"); s.set_defaults(fn=fn)
        if name == "annotate":
            s.add_argument("--verdict", required=True); s.add_argument("--comment")
        if name == "rate":
            s.add_argument("stars", type=int)
        if name == "request":
            s.add_argument("--question", required=True); s.add_argument("--to", action="append", default=[])
    s = sub.add_parser("answer"); s.add_argument("id"); s.add_argument("--text"); s.add_argument("--verdict")
    s.add_argument("--author"); s.set_defaults(fn=cmd_answer)
    s = sub.add_parser("import", help="replace the review data with an export (no merge)"); s.add_argument("file")
    s.add_argument("--force", action="store_true", help="also when the project has newer data"); s.set_defaults(fn=cmd_import)
    s = sub.add_parser("remap", help="move web pages kept under their address to the files of new [web] rules")
    s.set_defaults(fn=cmd_remap)
    s = sub.add_parser("export", help="write all review data to one file"); s.add_argument("file", nargs="?")
    s.set_defaults(fn=cmd_export)
    s = sub.add_parser("resolve"); s.add_argument("id"); s.add_argument("--note"); s.add_argument("--author")
    s.set_defaults(fn=cmd_resolve)

    args = ap.parse_args(argv)
    if args.root:
        os.chdir(args.root)
    try:
        args.fn(args)
    except (KeyError, ValueError, FileNotFoundError) as e:
        msg = str(e).strip("'\"")
        if args.json:
            print(json.dumps({"deciwa": "0.1", "command": args.cmd, "ok": False, "error": {"message": msg}}))
        else:
            print(f"deciwa: {msg}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
