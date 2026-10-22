"""JSON adapter: `python -m unittest discover packages/core/tests`."""

import json as stdjson
import unittest

from deciwa.core.adapters import json

SRC = """{
  "color": {
    "primary": "#1f6feb",
    "a/b~c": [1,
      {"x": null}]
  },
  "list": [],
  "s": "a long string"
}
"""


class JsonAdapter(unittest.TestCase):
    def test_selectors_lines_parents(self):
        els = json.elements(SRC)
        self.assertEqual([(e["key"], e["selector"], e["kind"], e["line"], e["end"], e["parent"]) for e in els], [
            ("1", "json:", "object", 1, 9, None),
            ("2", "json:/color", "object", 2, 6, "json:"),
            ("3", "json:/color/primary", "value", 3, 3, "json:/color"),
            ("4", "json:/color/a~1b~0c", "array", 4, 5, "json:/color"),
            ("5", "json:/color/a~1b~0c/0", "value", 4, 4, "json:/color/a~1b~0c"),
            ("6", "json:/color/a~1b~0c/1", "object", 5, 5, "json:/color/a~1b~0c"),
            ("7", "json:/color/a~1b~0c/1/x", "value", 5, 5, "json:/color/a~1b~0c/1"),
            ("8", "json:/list", "array", 7, 7, "json:"),
            ("9", "json:/s", "value", 8, 8, "json:"),
        ])
        self.assertEqual(els[3]["pointer"], "/color/a~1b~0c")
        self.assertEqual(els[0]["pointer"], "")

    def test_labels(self):
        labels = [e["label"] for e in json.elements(SRC)]
        self.assertEqual(labels, ["{3}", "color {2}", 'primary: "#1f6feb"', "a/b~c [2]", "0: 1", "1 {1}",
                                  "x: null", "list [0]", 's: "a long string"'])
        self.assertEqual(json.elements("[1, 2]")[0]["label"], "[2]")
        self.assertEqual(json.elements('"text"')[0]["label"], '"text"')
        long = json.elements(stdjson.dumps({"k": "x" * 100}))[1]["label"]
        self.assertEqual(len(long), len("k: ") + 70)
        self.assertTrue(long.endswith("…"))

    def test_canonical_text(self):
        root = json.elements(SRC)[0]
        self.assertEqual(root["text"], stdjson.dumps(stdjson.loads(SRC), sort_keys=True, ensure_ascii=False,
                                                     separators=(",", ":")))
        self.assertTrue(root["fingerprint"].startswith("sha256:"))

    def test_reformat_and_reorder_keep_fingerprints(self):
        data = stdjson.loads(SRC)
        other = stdjson.dumps(dict(reversed(list(data.items()))), indent=4)
        fp = lambda src: {e["selector"]: e["fingerprint"] for e in json.elements(src)}
        self.assertEqual(fp(SRC), fp(other))

    def test_changed_value_changes_element_and_parents(self):
        a = {e["selector"]: e["fingerprint"] for e in json.elements(SRC)}
        b = {e["selector"]: e["fingerprint"] for e in json.elements(SRC.replace("#1f6feb", "#000000"))}
        changed = sorted(s for s in a if a[s] != b[s])
        self.assertEqual(changed, ["json:", "json:/color", "json:/color/primary"])

    def test_one_line_document_order(self):
        sels = [e["selector"] for e in json.elements('{"a": 1, "b": [2, {"c": 3}]}')]
        self.assertEqual(sels, ["json:", "json:/a", "json:/b", "json:/b/0", "json:/b/1", "json:/b/1/c"])

    def test_repeated_key_last_counts(self):
        els = json.elements('{\n"a": 1,\n"a": 2\n}')
        self.assertEqual([(e["selector"], e["line"], e["text"]) for e in els[1:]], [("json:/a", 3, "2")])

    def test_multiline_string_and_bom(self):
        els = json.elements('\ufeff{"a":\n  "x"}')
        self.assertEqual([(e["selector"], e["line"], e["end"]) for e in els], [("json:", 1, 2), ("json:/a", 1, 2)])

    def test_invalid(self):
        for bad in ("{bad", "[1,]", "[NaN]", "", "{} {}", '{"a": 1 // c\n}', '{"a":1}\n{"b":2}'):
            self.assertEqual(json.elements(bad), [], bad)


if __name__ == "__main__":
    unittest.main()
