"""deciwa review UI: the overlay (JavaScript, CSS, logo) in the danwos tool UI
kit. Integrations ship these files with the pages they review."""

from pathlib import Path

STATIC = Path(__file__).parent / "static"
SCRIPT = "deciwa-overlay.js"
STYLE = "deciwa-overlay.css"

__all__ = ["STATIC", "SCRIPT", "STYLE"]
