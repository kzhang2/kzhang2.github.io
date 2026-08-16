#!/usr/bin/env python3
"""Regenerate site_data.json's `projects.items` from the shared side-projects metadata.

Single source of truth: ../site-pipeline/sideprojects.metadata.json (which projects are
public, plus title/image overrides) combined with ../site-pipeline/sideprojects-static-site/
site-data.json (auto-discovered demo path, produced by build_sideprojects_site.py). Run
`python3 build_sideprojects_site.py` in site-pipeline/ first so that file is up to date.

Each generated project card links straight to the Netlify-hosted demo instead of a copy
vendored into this repo, so there is nothing to hand-copy/rename when a project changes.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PIPELINE_ROOT = ROOT.parent / "site-pipeline"
METADATA_PATH = PIPELINE_ROOT / "sideprojects.metadata.json"
NETLIFY_SITE_DATA_PATH = PIPELINE_ROOT / "sideprojects-static-site" / "site-data.json"
SITE_DATA_PATH = ROOT / "site_data.json"

# The "sideprojects" alias deploy URL, not the production site URL — deploy_sideprojects.sh
# deploys to this same alias every time (`netlify deploy --alias=sideprojects`), so it never
# changes and is never a production deploy. Update the site-name half if the Netlify site is
# ever renamed/recreated (`netlify status --json` in site-pipeline/ shows the current name).
NETLIFY_SITE_URL = "https://sideprojects--wondrous-brigadeiros-fd4d90.netlify.app"


def build_project_items() -> list[dict]:
    metadata = json.loads(METADATA_PATH.read_text())["projects"]
    netlify_projects = {
        item["folder"]: item
        for item in json.loads(NETLIFY_SITE_DATA_PATH.read_text())["projects"]
    }

    items = []
    for entry in metadata:
        if not entry.get("personalSite"):
            continue

        folder = entry["folder"]
        netlify_entry = netlify_projects.get(folder)
        if netlify_entry is None or not netlify_entry.get("has_demo"):
            print(f"warning: {folder!r} is personalSite=true but has no Netlify demo — skipping")
            continue

        title = entry.get("title") or netlify_entry["title"]
        image = entry.get("image")
        if not image:
            print(f"warning: {folder!r} has no image set in metadata — card will have no thumbnail")

        demo_path = netlify_entry["demo_path"].lstrip("./")
        url = f"{NETLIFY_SITE_URL}/projects/{netlify_entry['slug']}/{demo_path}"

        items.append({"title": title, "image": image, "url": url})

    return items


def sync() -> None:
    site_data = json.loads(SITE_DATA_PATH.read_text())
    site_data["projects"]["items"] = build_project_items()
    SITE_DATA_PATH.write_text(json.dumps(site_data, indent=4) + "\n")
    print(f"synced {len(site_data['projects']['items'])} project(s) into {SITE_DATA_PATH.name}")


if __name__ == "__main__":
    sync()
