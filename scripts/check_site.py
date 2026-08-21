#!/usr/bin/env python3
"""Check that local references in a generated static site resolve."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


REFERENCE_ATTRIBUTES = {"href", "poster", "src"}
IGNORED_SCHEMES = {"data", "http", "https", "mailto", "tel"}


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in REFERENCE_ATTRIBUTES and value:
                self.references.append(value)


def resolve_reference(site_root: Path, page: Path, reference: str) -> Path | None:
    parsed = urlsplit(reference)
    if parsed.scheme in IGNORED_SCHEMES or parsed.netloc or not parsed.path:
        return None

    path = Path(unquote(parsed.path))
    target = site_root / str(path).lstrip("/") if parsed.path.startswith("/") else page.parent / path
    target = target.resolve()
    if site_root != target and site_root not in target.parents:
        raise ValueError(f"reference escapes site root: {reference}")
    if target.is_dir():
        target = target / "index.html"
    return target


def check(site_root: Path) -> list[str]:
    site_root = site_root.resolve()
    errors: list[str] = []
    for page in sorted(site_root.rglob("*.html")):
        parser = ReferenceParser()
        parser.feed(page.read_text(encoding="utf-8"))
        for reference in parser.references:
            try:
                target = resolve_reference(site_root, page, reference)
            except ValueError as error:
                errors.append(f"{page.relative_to(site_root)}: {error}")
                continue
            if target is not None and not target.is_file():
                errors.append(
                    f"{page.relative_to(site_root)}: missing {reference} "
                    f"({target.relative_to(site_root)})"
                )
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("site_root", type=Path)
    args = parser.parse_args()

    errors = check(args.site_root)
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Local links valid: {args.site_root.resolve()}")


if __name__ == "__main__":
    main()
