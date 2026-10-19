"""Annotation model: ids, fingerprints, verdicts, timestamps."""

from __future__ import annotations

import hashlib
import re
import secrets
import unicodedata
from datetime import datetime, timezone

SCHEMA = "0.1"

VERDICTS = ("approve", "reject", "rephrase", "details", "delete", "freeze", "note")
QUICK_ACTIONS = ("rephrase", "details", "delete")
KINDS = ("feedback", "rating", "request")

_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"


def new_id() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(8))


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text)).strip()


def fingerprint(text: str) -> str:
    return "sha256:" + hashlib.sha256(normalise(text).encode()).hexdigest()


def new_annotation(kind: str, element: dict, author: str, **fields) -> dict:
    """Build an annotation for an element of the elements index."""
    if kind not in KINDS:
        raise ValueError(f"unknown kind {kind!r}")
    verdict = fields.get("verdict")
    if kind == "feedback":
        if verdict not in VERDICTS:
            raise ValueError(f"unknown verdict {verdict!r}")
        if verdict == "note" and not fields.get("comment"):
            raise ValueError("a note needs a comment")
    if kind == "rating" and fields.get("stars") not in (0, 1, 2, 3, 4, 5):
        raise ValueError("quality must be 0-5")
    if kind == "request" and not fields.get("question"):
        raise ValueError("a request needs a question")

    selectors = [{"type": "structural", "value": element["selector"]}]
    snapshot = element["text"]
    quote = fields.pop("quote", None)
    if quote:
        q = quote["exact"]
        selectors.append({"type": "TextQuoteSelector", "exact": q,
                          "prefix": quote.get("prefix", ""), "suffix": quote.get("suffix", "")})
        snapshot = q
    # jobs for the AI or developer start open: quick actions, rejects, notes, questions
    open_ = kind == "request" or (kind == "feedback" and verdict in QUICK_ACTIONS + ("reject", "note"))
    ann = {
        "id": new_id(),
        "kind": kind,
        "target": {
            "selectors": selectors,
            "fingerprint": fingerprint(snapshot),
            "snapshot": snapshot,
        },
        "author": author,
        "created": now(),
        "status": "open" if open_ else "resolved",
        "replies": [],
    }
    for key in ("verdict", "stars", "comment", "question", "to"):
        if fields.get(key) not in (None, ""):
            ann[key] = fields[key]
    return ann
