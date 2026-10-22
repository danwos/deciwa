"""Markdown adapter and the engine without a build: `python -m unittest discover packages/core/tests`."""

import tempfile
import unittest
from pathlib import Path

from deciwa.core import Project
from deciwa.core.adapters import markdown

DOC = """---
summary: test
tags: [a]
---

# Title

First **bold** paragraph with a [link](x.md).

## Part

- one
  - nested
- two

> quoted paragraph

| a | b |
|---|---|
| 1 | 2 |

```py
code
```

![A picture](pic.png)

## Part

Again.
"""


class MarkdownAdapter(unittest.TestCase):
    def setUp(self):
        self.els = markdown.elements(DOC)
        self.by = {e["selector"]: e for e in self.els}

    def test_selectors_and_lines(self):
        self.assertEqual([(e["selector"], e["line"]) for e in self.els], [
            ("md:heading:Title", 6),
            ("md:paragraph:Title#1", 8),
            ("md:heading:Title/Part", 10),
            ("md:item:Title/Part#1", 12),
            ("md:item:Title/Part#2", 13),
            ("md:item:Title/Part#3", 14),
            ("md:paragraph:Title/Part#1", 16),
            ("md:row:Title/Part#1", 20),
            ("md:code:Title/Part#1", 22),
            ("md:figure:Title/Part#1", 26),
            ("md:heading:Title/Part~2", 28),
            ("md:paragraph:Title/Part~2#1", 30),
        ])

    def test_visible_text(self):
        self.assertEqual(self.by["md:paragraph:Title#1"]["text"], "First bold paragraph with a link.")
        self.assertEqual(self.by["md:item:Title/Part#1"]["text"], "one nested")
        self.assertEqual(self.by["md:row:Title/Part#1"]["text"], "1 | 2")

    def test_parents_and_sections(self):
        self.assertEqual(self.by["md:item:Title/Part#2"]["parent"], "md:item:Title/Part#1")
        self.assertEqual(self.by["md:paragraph:Title/Part#1"]["parent"], "md:heading:Title/Part")
        self.assertIn("quoted paragraph", self.by["md:heading:Title/Part"]["text"])
        self.assertTrue(self.by["md:heading:Title"]["fingerprint"].startswith("sha256:"))

    def test_no_frontmatter(self):
        self.assertEqual(markdown.elements("# A\n\nB\n")[1]["line"], 3)


class ProjectWithoutBuild(unittest.TestCase):
    def test_annotate_and_summary(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / ".deciwa" / "annotations").mkdir(parents=True)
            (root / "notes").mkdir()
            (root / "notes" / "a.md").write_text(DOC)
            p = Project(root)
            p.add("notes/a.md", "md:paragraph:Title#1", "feedback", verdict="approve")
            p.add("notes/a.md", "md:item:Title/Part#3", "request", question="Keep?")
            s = p.summary()["notes/a.md"]
            self.assertEqual(s["states"], {"approved": 1, "requested": 1})
            self.assertEqual((s["questions"], s["jobs"]), (1, 1))
            self.assertEqual(p.todo()[0]["line"], 14)
            (root / "notes" / "a.md").write_text(DOC.replace("First **bold**", "First"))
            self.assertEqual(p.summary()["notes/a.md"]["states"].get("stale"), 1)
            self.assertIn("notes/a.md", p.pages())


if __name__ == "__main__":
    unittest.main()
