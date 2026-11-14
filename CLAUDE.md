# CLAUDE.md

**natemcguire.com**: Nate McGuire's personal site. One page: his name and three roles set around a rounded
triangle with physics and sound, plus two "for fun" links. Read [README.md](README.md) first; it is current.

## How it's built

- `site/` is deployed as is. No build step, no npm dependencies, no framework. Keep it that way.
- `site/physics.mjs` is pure (no DOM) and covered by `node --test test/*.test.mjs`. `site/main.mjs` is the
  canvas, input, sound and state; check changes to it in a browser.
- The copy is `TEXT` in `site/main.mjs`; `site/index.html` repeats it as the no-JavaScript and screen-reader text.
  Change both together.
- The `<head>` of `site/index.html` carries what search engines show: the title, the description, and structured data
  (a Person with the LinkedIn profile as `sameAs`; the LinkedIn link is not shown on the page). Nate's rule (2026-11-14):
  no employer and no specific company names anywhere in that metadata.
- Tuning lives in the constants at the top of `site/main.mjs`.
- Browser checks run headless on the MacBook Pro, not in Chrome on the Mac mini: serve `site/` on the mini, forward
  the port with `ssh -R` to `macbook-pro`, and drive headless Chrome there. The project is not copied to the Pro.
- On a phone, tilt and shake move the triangle (`devicemotion` and `deviceorientation`). The sensors need HTTPS and an
  iPhone asks permission on the first tap, so that part can only be tried on a deployed preview. iPhones report the
  sensor with the opposite sign to Android; `phone.sign` in `site/main.mjs` handles it.

## Deploy

Cloudflare Pages project `natemcguire-v2`, direct upload from the Mac mini (not Git-triggered):

```sh
python3 deploy.py --preview    # preview URL
python3 deploy.py              # production
```

- Branch is `master`. Google Analytics: G-MP2PD28L5S.
- The GitHub remote `origin` is a public repo.
- The repository's history starts on 2026-11-14 with this one-page site; Nate had the earlier history erased from
  GitHub. A full backup of the old history is the file `.git/history-before-2026-11-14.bundle` on the Mac mini.
- Untracked leftovers from the old site (`v2/articles/`, `v3/`, `design-briefs/candidates-round4/`, `_air-wip-*`,
  `_mini-untracked-*`, `.releases/`) stay on disk until Nate clears them.
