# Singularity Clicker

An incremental journey from prehistory to the singularity, with a different style of play as technology and society develop.

Browser first. macOS and iOS editions are planned. The art is drawn directly; no image-generator assets.

## Project website

The Jekyll website lives in `website/`. The GitHub Pages workflow builds it on pushes to `main`.

Expected address after Pages is enabled and deployment succeeds:
https://jhacksman.github.io/singularity-clicker/

One-time setup: Settings → Pages → Build and deployment → Source → GitHub Actions. Then run the **Publish project website** workflow from Actions if it has not already deployed.

## Game source transfer

Stage 0 (The Cave) and a first playable Stage 1 (The Hearth) were built in the project workspace. Those files have **not yet been transferred into this repository** because that workspace is currently unavailable. This repository presently contains the Jekyll site and publishing workflow.

When the prepared source is added, preserve `website/` and `.github/workflows/pages.yml`. The workflow detects `build.mjs`, runs simulation tests when present, builds the browser pages, and publishes them under `/play/`. Play links appear only when both game pages exist.

Keep private hosting metadata, credentials, and old Git history out of this public repository. No software license has been selected yet.

## Site structure

- `website/index.html`: overview and stage status
- `website/design.md`: core design direction
- `website/_layouts/default.html`: shared page layout
- `website/assets/site.css`: responsive styling
- `.github/workflows/pages.yml`: Jekyll build and GitHub Pages deployment

GitHub Pages hosts static files. Gameplay runs in the browser; no application server is required.
