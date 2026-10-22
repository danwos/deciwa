"""Engine: moved elements and orphan jobs – `python -m unittest discover packages/core/tests`."""

import json
import tempfile
import unittest
from pathlib import Path

from deciwa.core import Project, store
from deciwa.core.adapters import json as json_adapter, markdown


def project(files: dict[str, str]) -> tuple[Project, Path, tempfile.TemporaryDirectory]:
    tmp = tempfile.TemporaryDirectory()
    root = Path(tmp.name)
    (root / ".deciwa" / "annotations").mkdir(parents=True)
    for name, text in files.items():
        (root / name).write_text(text)
    return Project(root), root, tmp


class MovedElements(unittest.TestCase):
    def test_array_item_shifted_keeps_review(self):
        p, root, tmp = project({"d.json": json.dumps({"steps": ["build", "test"]})})
        with tmp:
            p.add("d.json", "json:/steps/1", "feedback", verdict="approve")
            p.add("d.json", "json:/steps", "feedback", verdict="approve")
            (root / "d.json").write_text(json.dumps({"steps": ["lint", "build", "test"]}))
            view = p.view("d.json", p.parse("d.json")["elements"])
            states = {sel: st["state"] for sel, st in view["elements"].items()}
            self.assertEqual(states, {"json:/steps/2": "approved", "json:/steps": "stale"})

    def test_changed_value_stays_stale(self):
        els = json_adapter.elements('["a", "b"]')
        ann = {"target": {"selectors": [{"type": "structural", "value": "json:/1"}],
                          "fingerprint": els[2]["fingerprint"], "snapshot": els[2]["text"]}}
        element, changed = Project.resolve(ann, json_adapter.elements('["a", "c"]'))
        self.assertEqual((element["selector"], changed), ("json:/1", True))
        # ambiguous: the reviewed text is in two other places – keep the selector
        element, changed = Project.resolve(ann, json_adapter.elements('["x", "b", "b"]'))
        self.assertEqual((element["selector"], changed), ("json:/1", False))
        element, changed = Project.resolve(ann, json_adapter.elements('["x", "y", "b", "b"]'))
        self.assertEqual((element["selector"], changed), ("json:/1", True))

    def test_markdown_paragraph_counter_shift(self):
        old = markdown.elements("# T\n\nFirst.\n\nSecond.\n")
        second = next(e for e in old if e["selector"] == "md:paragraph:T#2")
        ann = {"target": {"selectors": [{"type": "structural", "value": second["selector"]}],
                          "fingerprint": second["fingerprint"], "snapshot": second["text"]}}
        element, changed = Project.resolve(ann, markdown.elements("# T\n\nNew.\n\nFirst.\n\nSecond.\n"))
        self.assertEqual((element["selector"], changed), ("md:paragraph:T#3", False))


class OrphanJobs(unittest.TestCase):
    def test_resolved_notes_and_answered_questions_need_no_relink(self):
        doc = "# T\n\n- one\n- two\n- three\n"
        p, root, tmp = project({"a.md": doc})
        with tmp:
            q = p.add("a.md", "md:item:T#2", "request", question="Keep?")
            p.resolve_job(q["id"], "yes")
            p.add("a.md", "md:item:T#2", "feedback", verdict="note", comment="hm")
            p.resolve_job(p.add("a.md", "md:item:T#2", "feedback", verdict="note", comment="done")["id"])
            p.add("a.md", "md:item:T#2", "feedback", verdict="approve")
            p.add("a.md", "md:item:T#3", "request", question="Open?")
            (root / "a.md").write_text("# T\n\nOther text.\n")
            anns = {a["id"]: a for a in store.load(root, "a.md")}
            relink = [j for j in p.todo() if j["job"] == "relink"]
            kinds = sorted(anns[j["id"]].get("verdict") or anns[j["id"]]["kind"] for j in relink)
            # the open note, the approval and the open question stay; the answered question and the resolved note go
            self.assertEqual(kinds, ["approve", "note", "request"])

if __name__ == "__main__":
    unittest.main()


class Facts(unittest.TestCase):
    DOC = "---\nsummary: s\n---\n\n# Founder\n\nIntro.\n\n## Career\n\n- one\n- two [ASSUMPTION]\n\n| a | b |\n|---|---|\n| x | y |\n"

    def facts_project(self):
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        (root / ".deciwa" / "annotations").mkdir(parents=True)
        (root / "20_facts" / "company").mkdir(parents=True)
        (root / "20_facts" / "company" / "founder.md").write_text(self.DOC)
        (root / "20_facts" / "_index.md").write_text("# Facts\n\n- [company](company/)\n")
        (root / "notes.md").write_text("# Notes\n\n- not a fact\n")
        return Project(root), root, tmp

    def test_fact_files_and_kinds(self):
        p, root, tmp = self.facts_project()
        with tmp:
            self.assertEqual(p.fact_files(), ["20_facts/company/founder.md"])
            f = p.facts()["files"][0]
            self.assertEqual([(x["kind"], x["context"], x["group"]) for x in f["facts"]],
                             [("paragraph", "", "open"), ("item", "Career", "open"),
                              ("item", "Career", "unverified"), ("row", "Career", "open")])
            self.assertEqual(f["file"], "unreviewed")
            # the whole-file element only exists in facts files
            self.assertNotIn("file:", [e["selector"] for e in p.parse("notes.md")["elements"]])

    def test_file_approval_stale_on_any_change_facts_stay(self):
        p, root, tmp = self.facts_project()
        src = "20_facts/company/founder.md"
        with tmp:
            r = p.approve_facts([src])
            self.assertEqual(r["approved"], 5)  # four facts and the file
            f = p.facts([src])["files"][0]
            self.assertEqual(f["file"], "approved")
            self.assertEqual(f["counts"], {"approved": 3, "open": 0, "stale": 0, "question": 0, "unverified": 1})
            (root / src).write_text(self.DOC.replace("summary: s", "summary: t").replace("- one", "- one!"))
            f = p.facts([src])["files"][0]
            self.assertEqual(f["file"], "stale")
            self.assertEqual({x["label"]: x["group"] for x in f["facts"]},
                             {"Intro.": "approved", "one!": "stale", "two [ASSUMPTION]": "unverified", "x | y": "approved"})

    def test_approve_leaves_questions_alone(self):
        p, root, tmp = self.facts_project()
        src = "20_facts/company/founder.md"
        with tmp:
            p.add(src, "md:item:Founder/Career#1", "request", question="Still true?")
            p.approve_facts([src])
            groups = [x["group"] for x in p.facts([src])["files"][0]["facts"]]
            self.assertEqual(groups, ["approved", "question", "unverified", "approved"])
            with self.assertRaises(ValueError):
                p.approve_facts(["notes.md"])
