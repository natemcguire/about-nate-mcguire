# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**natemcguire.com** — A static personal bio/portfolio site for Nate McGuire at natemcguire.com. Retro DOS-terminal-inspired UI with career history, achievements, press coverage, and professional background.

## Structure

- `index.html` — Main bio page (retro "window" card UI with VT323 monospace font)
- `retro-profile.html` — Alternate retro profile layout
- `about-nate-mcguire.html` — About page
- `clean-gpt.html` — Clean GPT-generated version
- `cycle-ios-8-swift-and-the-apple-watch-cycling-tracker.html` — Blog post about iOS/Apple Watch development
- `land-rover*.html` — Land Rover content pages
- `images/` — Portrait/headshot images
- `CNAME` — GitHub Pages custom domain (natemcguire.com)
- `sitemap.xml`, `robots.txt` — SEO files
- `favicon.ico` — Site favicon

## Design

- Font: VT323 (monospace, retro terminal aesthetic)
- Warm cream background (#fff5e6) with black "window" cards (box-shadow: 4px 4px 0px)
- Blue accent color (#0033CC) for headings
- Google Analytics: G-MP2PD28L5S

## Tech Stack

- **Static HTML/CSS/JS** — No build step, no dependencies
- **Hosting**: GitHub Pages (repo: natemcguire/about-nate-mcguire, custom domain: natemcguire.com)

## Development

No build step. Edit HTML files directly. Push to `main` to deploy via GitHub Pages.
