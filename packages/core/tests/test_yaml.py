"""YAML adapter: `python -m unittest discover packages/core/tests`."""

import unittest

from deciwa.core.adapters import yaml

SRC = """# settings
base: &base
  host: x
  port: 1

prod:
  <<: *base
  port: 2
  tags: [a, b]
  text: |
    hello
    world

  ref: *base
jobs:
  - name: build
    steps:
      - run: a

      - b
# trailing comment
10: ten
"""


def rows(src):
    return [(e["selector"], e["kind"], e["line"], e["end"], e["parent"]) for e in yaml.elements(src)]


class YamlAdapter(unittest.TestCase):
    def test_selectors_lines_parents(self):
        self.assertEqual(rows(SRC), [
            ("yaml:", "object", 2, 22, None),
            ("yaml:/base", "object", 2, 4, "yaml:"),
            ("yaml:/base/host", "value", 3, 3, "yaml:/base"),
            ("yaml:/base/port", "value", 4, 4, "yaml:/base"),
            ("yaml:/prod", "object", 6, 14, "yaml:"),
            ("yaml:/prod/port", "value", 8, 8, "yaml:/prod"),
            ("yaml:/prod/tags", "array", 9, 9, "yaml:/prod"),
            ("yaml:/prod/tags/0", "value", 9, 9, "yaml:/prod/tags"),
            ("yaml:/prod/tags/1", "value", 9, 9, "yaml:/prod/tags"),
            ("yaml:/prod/text", "value", 10, 12, "yaml:/prod"),
            ("yaml:/prod/ref", "object", 14, 14, "yaml:/prod"),
            ("yaml:/jobs", "array", 15, 20, "yaml:"),
            ("yaml:/jobs/0", "object", 16, 20, "yaml:/jobs"),
            ("yaml:/jobs/0/name", "value", 16, 16, "yaml:/jobs/0"),
            ("yaml:/jobs/0/steps", "array", 17, 20, "yaml:/jobs/0"),
            ("yaml:/jobs/0/steps/0", "object", 18, 18, "yaml:/jobs/0/steps"),
            ("yaml:/jobs/0/steps/0/run", "value", 18, 18, "yaml:/jobs/0/steps/0"),
            ("yaml:/jobs/0/steps/1", "value", 20, 20, "yaml:/jobs/0/steps"),
            ("yaml:/10", "value", 22, 22, "yaml:"),
        ])

    def test_merge_and_alias_values(self):
        els = {e["selector"]: e for e in yaml.elements(SRC)}
        self.assertEqual(els["yaml:/prod"]["text"],
                         '{"host":"x","port":2,"ref":{"host":"x","port":1},"tags":["a","b"],"text":"hello\\nworld\\n"}')
        self.assertEqual(els["yaml:/prod/ref"]["text"], '{"host":"x","port":1}')
        self.assertEqual(els["yaml:/prod"]["label"], "prod {5}")
        self.assertEqual(els["yaml:/jobs/0/steps"]["label"], "steps [2]")
        self.assertEqual(els["yaml:/10"]["label"], '10: "ten"')

    def test_block_collection_ends_on_last_value(self):
        self.assertEqual(rows("a:\n  b: 1\n  c: 2\nd: 3\n")[1][2:4], (1, 3))
        self.assertEqual(rows("a:\n  - 1\n  - 2\n\n\nd: 3\n")[1][2:4], (1, 3))
        self.assertEqual(rows("a: |\n  x\n\n  y\n\nb: 1\n")[1][2:4], (1, 4))
        self.assertEqual(rows("a: {b: 1,\n  c: 2}\nd: 3\n")[1][2:4], (1, 2))

    def test_pointer_escaping_and_keys(self):
        els = yaml.elements("a/b: 1\n'~x': 2\nnull: 3\n")
        self.assertEqual([e["pointer"] for e in els], ["", "/a~1b", "/~0x", "/null"])

    def test_same_fingerprints_as_json_and_on_reformat(self):
        from deciwa.core.adapters import json
        y = {e["pointer"]: e["fingerprint"] for e in yaml.elements("b:\n  - 1\n  - {c: true}\na: x\n")}
        j = {e["pointer"]: e["fingerprint"] for e in json.elements('{"a": "x", "b": [1, {"c": true}]}')}
        self.assertEqual(y, j)

    def test_first_document_only(self):
        self.assertEqual([e["selector"] for e in yaml.elements("---\na: 1\n---\nb: 2\n")], ["yaml:", "yaml:/a"])

    def test_invalid_or_empty(self):
        for bad in ("a: [b", "a: b\n c: d\n  - e", "", "# only a comment\n", "a: !!python/object:os.system x"):
            self.assertEqual(yaml.elements(bad), [], bad)


if __name__ == "__main__":
    unittest.main()
