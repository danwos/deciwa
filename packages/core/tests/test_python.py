"""Python adapter: `python -m unittest discover packages/core/tests`."""

import unittest

from deciwa.core.adapters import python

SRC = '''"""Module."""
import os


def main():
    return 1


class Engine:
    """An engine."""

    @property
    def port(self):
        return 1

    @port.setter
    def port(self, v):
        pass

    async def start(self):
        def inner():
            pass
        return inner


if os.name == "nt":
    def windows_only():
        pass
'''


class PythonAdapter(unittest.TestCase):
    def test_selectors_lines_parents(self):
        els = python.elements(SRC)
        self.assertEqual([(e["selector"], e["line"], e["end"], e["parent"]) for e in els], [
            ("py:function:main", 5, 6, None),
            ("py:class:Engine", 9, 23, None),
            ("py:function:Engine.port", 12, 14, "py:class:Engine"),
            ("py:function:Engine.port~2", 16, 18, "py:class:Engine"),
            ("py:function:Engine.start", 20, 23, "py:class:Engine"),
            ("py:function:Engine.start.inner", 21, 22, "py:function:Engine.start"),
            ("py:function:windows_only", 27, 28, None),
        ])

    def test_text_and_label(self):
        e = python.elements(SRC)[2]
        self.assertTrue(e["text"].startswith("@property def port(self):"))
        self.assertEqual(e["label"], "def port(self):")

    def test_changed_body_changes_fingerprint(self):
        a = python.elements(SRC)[0]["fingerprint"]
        b = python.elements(SRC.replace("return 1\n\n\nclass", "return 2\n\n\nclass"))[0]["fingerprint"]
        self.assertNotEqual(a, b)

    def test_syntax_error(self):
        self.assertEqual(python.elements("def broken(:\n"), [])


if __name__ == "__main__":
    unittest.main()
