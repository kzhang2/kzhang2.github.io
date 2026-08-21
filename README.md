# Kevin W. Zhang's personal website

This repository contains the source for [kevinwzhang.com](https://kevinwzhang.com).
The homepage is generated from structured content, while articles are standalone
pages that share a common stylesheet.

## Layout

- `content/site.json`: homepage content and publication metadata.
- `articles/`: article content fragments published under `/articles/<slug>/`.
- `static/`: deployable styles, images, documents, and optimized project previews.
- `media-src/`: source media that should not be copied into the public site.
- `scripts/build.py`: builds the deployable `_site/` directory.
- `scripts/sync_projects.py`: refreshes personal-site project cards from the
  adjacent `site-pipeline` workspace.

`index.html` and other generated files live only in `_site/`; do not edit them
directly. Each article keeps only its body in `content.html`; the builder wraps
it in the shared article template and stylesheet.

## Development

Build and validate the site:

```sh
python3 scripts/build.py
python3 scripts/check_site.py _site
```

For automatic rebuilds and a local server, install `entr` and run:

```sh
./dev.sh
```

To update side-project cards, first rebuild `../site-pipeline`, then run:

```sh
python3 scripts/sync_projects.py
```

## Deployment

`.github/workflows/pages.yml` builds `_site/` and deploys that artifact through
GitHub Pages. The repository's Pages source must be set to **GitHub Actions** in
the repository settings before enabling the workflow.

The legacy article paths are emitted as redirects. `2025_zora_bday.mp4` is also
copied to its historical root URL because that standalone public link may have
been shared externally.
