"""deciwa core: the annotation model, the .deciwa/ store and the engine.

Every front end – CLI, server, Sphinx extension, later VS Code or Chrome –
goes through :class:`Project`; none of them touches the files directly.
"""

from .engine import Project

__all__ = ["Project"]
