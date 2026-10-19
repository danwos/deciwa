# Installation

The Sphinx integration is the package `deciwa-sphinx`; it brings the review
UI (`deciwa-ui`) along. The `deciwa` command comes from `deciwa-cli`. Until
the packages are published, install them from the repository.

## Requirements

- Python 3.12 or newer
- Sphinx 9; Sphinx-Needs and MyST are optional but recognised

## Install

```console
$ cd <deciwa>/packages
$ uv pip install -e core -e server -e cli -e ui -e sphinx   # from your project's environment
$ deciwa init                      # creates .deciwa/ in the repository root
```

## Add the extension

In `conf.py`:

```python
extensions = [
    "myst_parser",       # if you write Markdown
    "sphinx_needs",      # if you use Sphinx-Needs
    "deciwa.sphinx",
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
