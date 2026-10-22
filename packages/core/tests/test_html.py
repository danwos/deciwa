"""HTML adapter: `python -m unittest discover packages/core/tests`."""

import unittest

from deciwa.core.adapters import html

PAGE = """<!doctype html>
<html><head><title>Offer</title><script>var x = "<p>not a paragraph</p>"</script></head>
<body>
<nav><p>Navigation text here</p></nav>
<main>
  <h1>Offer</h1>
  <p>We build review tools for docs
     and websites.</p>
  <div class="card"><p>Inside a card.</p></div>
  <h2>Prices</h2>
  <ul><li>Small team</li><li>Large team</li></ul>
  <table><thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Basic</td><td>10</td></tr></tbody></table>
  <figure><img src="a.png" alt="Diagram"><figcaption>How it works</figcaption></figure>
  <div>Some loose text in a div.</div>
  <p>Unclosed paragraph
  <h2>Prices</h2>
</main>
</body></html>
"""


class HtmlAdapter(unittest.TestCase):
    def test_elements(self):
        els = html.elements(PAGE)
        self.assertEqual([(e["selector"], e["line"], e["tag"]) for e in els], [
            ("html:heading:Offer", 6, "h1"),
            ("html:paragraph:Offer#1", 7, "p"),
            ("html:paragraph:Offer#2", 9, "p"),
            ("html:heading:Offer/Prices", 10, "h2"),
            ("html:item:Offer/Prices#1", 11, "li"),
            ("html:item:Offer/Prices#2", 11, "li"),
            ("html:row:Offer/Prices#1", 12, "tr"),
            ("html:figure:Offer/Prices#1", 13, "figure"),
            ("html:paragraph:Offer/Prices#1", 14, "div"),
            ("html:paragraph:Offer/Prices#2", 15, "p"),
            ("html:heading:Offer/Prices~2", 16, "h2"),
        ])

    def test_text_and_ranges(self):
        els = {e["selector"]: e for e in html.elements(PAGE)}
        self.assertEqual(els["html:paragraph:Offer#1"]["text"], "We build review tools for docs and websites.")
        self.assertEqual(els["html:paragraph:Offer#1"]["end"], 8)
        self.assertEqual(els["html:row:Offer/Prices#1"]["text"], "Basic | 10")
        self.assertEqual(els["html:figure:Offer/Prices#1"]["label"], "How it works")
        self.assertIn("Prices", els["html:heading:Offer"]["text"])

    def test_title(self):
        self.assertEqual(html.title(PAGE, "x"), "Offer")


if __name__ == "__main__":
    unittest.main()
