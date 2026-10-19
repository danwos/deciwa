"""deciwa server: serves a built site with the review API (JSON) and
rebuilds it on change. Reused by every integration that reviews in a browser."""

from .app import Builder, serve

__all__ = ["Builder", "serve"]
