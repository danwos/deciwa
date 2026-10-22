"""Finding .deciwa/ and reading and writing annotation files."""

from __future__ import annotations

import json
import os
import tomllib
from pathlib import Path

from .model import SCHEMA, now

FOLDER = ".deciwa"
WEB = "web:"            # web pages without a source file: web:<host><path>
WEB_PAGES = "web-pages.json"


def find_root(start: Path) -> Path:
    """The folder that holds .deciwa/, found like Git finds .git/."""
    start = start.resolve()
    for folder in (start, *start.parents):
        if (folder / FOLDER).is_dir():
            return folder
    raise FileNotFoundError(f"no {FOLDER}/ found above {start} – run 'deciwa init'")


def config(root: Path) -> dict:
    path = root / FOLDER / "config.toml"
    cfg = tomllib.loads(path.read_text()) if path.exists() else {}
    cfg.setdefault("author", os.environ.get("DECIWA_AUTHOR", "daniel"))
    sphinx = cfg.setdefault("sphinx", {})
    sphinx.setdefault("docs", "docs")
    sphinx.setdefault("build", "docs/_build/html")
    review = cfg.setdefault("review", {})
    review.setdefault("required", [])
    review.setdefault("paths", [])
    facts = cfg.setdefault("facts", {})
    facts.setdefault("paths", ["20_facts/*.md", "*/20_facts/*.md"])
    facts.setdefault("exclude", ["*/_index.md", "_index.md"])
    facts.setdefault("kinds", ["item", "row", "paragraph"])
    return cfg


SECTION_HELP = {
    "review": [
        "# required: what must be approved – element kinds (need, heading, paragraph, item,",
        "# row, code, note, figure, class, function, statement, object, array, value), \"all\",",
        "# or selector patterns like \"sphinx-needs:PROP_*\".",
        "# paths: optional, only these sources, e.g. [\"docs/technical/*\"]. Everything else",
        "# can still get feedback; it just does not count.",
    ],
    "facts": [
        "# The facts view (DEC_FACT_BLOCKS): which files hold facts and which elements",
        "# are one fact each. paths and exclude are patterns (* also matches /).",
    ],
}


def _toml_value(v) -> str:
    if isinstance(v, list):
        return "[" + ", ".join(_toml_value(x) for x in v) + "]"
    return json.dumps(v, ensure_ascii=False)


def save_config(root: Path, cfg: dict) -> None:
    """Write the settings back (flat keys first, then one table per section)."""
    lines = [f"{k} = {_toml_value(v)}" for k, v in cfg.items() if not isinstance(v, dict)]
    for section, values in cfg.items():
        if isinstance(values, dict):
            lines += ["", f"[{section}]", *SECTION_HELP.get(section, [])]
            lines += [f"{k} = {_toml_value(v)}" for k, v in values.items()]
    (root / FOLDER / "config.toml").write_text("\n".join(lines) + "\n")


def annotation_path(root: Path, source: str) -> Path:
    if source.startswith(WEB):  # web:danwos.dev/de/tools -> _web/danwos.dev/de/tools.json
        host, _, path = source[len(WEB):].partition("/")
        return root / FOLDER / "annotations" / "_web" / host.replace(":", "_") / f"{path.strip('/') or 'index'}.json"
    return root / FOLDER / "annotations" / f"{source}.json"


def load(root: Path, source: str) -> list[dict]:
    path = annotation_path(root, source)
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return data.get("annotations", [])


def save(root: Path, source: str, annotations: list[dict]) -> None:
    path = annotation_path(root, source)
    touch(root)
    if not annotations:
        path.unlink(missing_ok=True)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    annotations = sorted(annotations, key=lambda a: (a["created"], a["id"]))
    data = {"deciwa": SCHEMA, "source": source, "annotations": annotations}
    path.write_text(json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n")


def touch(root: Path) -> None:
    """Remember when the review data changed last (guards imports of older files)."""
    (root / FOLDER / "updated").write_text(now() + "\n")


def updated(root: Path) -> str | None:
    path = root / FOLDER / "updated"
    return path.read_text().strip() if path.exists() else None


def clear(root: Path) -> None:
    for source in sources(root):
        annotation_path(root, source).unlink()


def sources(root: Path) -> list[str]:
    base = root / FOLDER / "annotations"
    if not base.exists():
        return []
    out = []
    for p in base.rglob("*.json"):
        rel = p.relative_to(base).as_posix()[: -len(".json")]
        if rel.startswith("_web/"):  # the address is kept in the file, the path is only for people
            rel = json.loads(p.read_text()).get("source") or rel
        out.append(rel)
    return sorted(out)


def web_pages(root: Path) -> dict:
    """The elements of reviewed web pages, as the browser found them, by address."""
    path = root / FOLDER / WEB_PAGES
    return json.loads(path.read_text()) if path.exists() else {}


def save_web_pages(root: Path, pages: dict) -> None:
    path = root / FOLDER / WEB_PAGES
    path.write_text(json.dumps(pages, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
