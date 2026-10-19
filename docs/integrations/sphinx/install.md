# Installation

The Sphinx integration ships with the deciwa prototype in this repository
(`prototype/`); later it comes with the published CLI as `deciwa[sphinx]`.

## Requirements

- Python 3.12 or newer
- Sphinx 9; Sphinx-Needs and MyST are optional but recognised

## Install

```console
$ uv pip install -e prototype      # the CLI and the Sphinx extension
$ deciwa init                      # creates .deciwa/ in the repository root
```

## Add the extension

In `conf.py`:

```python
extensions = [
    "myst_parser",       # if you write Markdown
    "sphinx_needs",      # if you use Sphinx-Needs
    "deciwa_proto.sphinx_ext",
]
```

The extension finds `.deciwa/` by walking up from the folder of `conf.py`.
If it lives somewhere else, set `deciwa_root` – see
[configuration](configuration.md).

## Check

```console
$ deciwa serve
deciwa: building docs …
deciwa: build 1 ok
deciwa: review at http://127.0.0.1:4337/
```

Open the address; the round deciwa logo at the bottom right means the
overlay is there.
