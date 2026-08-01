# fabriziobagala.com

[![Deploy](https://img.shields.io/github/actions/workflow/status/fabriziobagala/fabriziobagala.github.io/hugo.yml?branch=main&style=for-the-badge&logo=github&label=Deploy)](https://github.com/fabriziobagala/fabriziobagala.github.io/actions/workflows/hugo.yml)
![Hugo](https://img.shields.io/badge/Hugo-0.164.0%20extended-ff4088?style=for-the-badge&logo=hugo&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

Source code for my personal website: a portfolio and a technical blog. Built with [Hugo](https://gohugo.io/) and hand-written layouts, no external theme, and deployed to GitHub Pages.

**Live site:** [fabriziobagala.com](https://fabriziobagala.com)

## Features

- **Custom build, no theme.** Every layout, partial and shortcode is hand-written.
- **Light and dark mode** with a theme toggle and system-preference detection.
- **Responsive, mobile-first** design built on plain CSS.
- **Technical blog** with a SOLID principles series, tags, reading time, share links and an RSS feed.
- **KaTeX** math rendering and **syntax highlighting** for code blocks.
- **Contact form** powered by [Web3Forms](https://web3forms.com/), no backend required.
- **SEO and PWA ready:** sitemap, robots, Open Graph social card, web manifest and favicons.
- **Hardened CI:** pinned Hugo version verified by SHA256, SHA-pinned GitHub Actions.

## Tech stack

- [Hugo Extended](https://gohugo.io/) v0.164.0 (static site generator)
- Plain HTML, CSS and vanilla JavaScript, bundled and fingerprinted by Hugo Pipes
- [KaTeX](https://katex.org/) for math
- Icons from [Font Awesome](https://fontawesome.com/) Free 7.3.1 (self-hosted SVGs)
- GitHub Actions and GitHub Pages for build and deploy

## Project structure

```text
.
├── archetypes/          # Front-matter templates for new content
├── assets/              # Pipeline assets bundled by Hugo (CSS, JS, icons, images)
├── content/             # Markdown content (about, blog, contact, portfolio)
├── i18n/                # UI strings (en.yaml)
├── layouts/             # Templates, partials and shortcodes
├── static/              # Files served verbatim (favicons, KaTeX, robots.txt, CNAME)
├── hugo.toml            # Site configuration
└── .github/workflows/   # Build and deploy pipeline
```

## Getting started

### Prerequisites

- [Hugo Extended](https://gohugo.io/installation/) v0.164.0 (the version used in CI; the Extended build is required for the asset pipeline)

### Run locally

```bash
hugo server
```

Then open <http://localhost:1313>.

### Build for production

```bash
hugo --gc --minify
```

The generated site is written to `public/`.

## Deployment

Every push to `main` triggers the [Deploy Hugo site to Pages](.github/workflows/hugo.yml) workflow, which installs the pinned Hugo Extended version (verified by checksum), builds the site and publishes `public/` to GitHub Pages. The custom domain is configured through [`static/CNAME`](static/CNAME).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
