"""deciwa for Sphinx: tags every reviewable element of the built pages and adds
the review UI. Use it as ``extensions = ["deciwa.sphinx"]``."""

from .extension import setup

__all__ = ["setup"]
