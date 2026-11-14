# natemcguire.com

Nate McGuire's personal site: one line of text set around a rounded triangle that you can grab, throw, bounce off the edges of the window, squash and pop. On a phone it also follows the phone: tilt it and the triangle falls toward the low edge, shake it and it rattles. Live at https://natemcguire.com.

```sh
python3 -m http.server 8765 --directory site    # then open http://localhost:8765
```

## Get started

1. Serve `site/` with the command above. There is no build step.
2. Change the words in `TEXT` at the top of `site/main.mjs`, and the matching fallback text in `site/index.html`.
3. `node --test test/*.test.mjs` runs the physics tests.

No dependencies: plain HTML, two JavaScript modules and one font file.

## What it does

- `site/index.html` holds the page, its styles, the "for fun" links at the bottom and the speaker button in the bottom right corner.
- `site/main.mjs` draws the text on a canvas and handles the pointer, the colours, the sound (synthesized, no audio files), the squash and the pop.
- `site/physics.mjs` is the triangle's geometry and the rigid-body physics. It has no DOM code, so the tests run it under Node.
- An iPhone has to be asked before it shares its motion, on every visit, and only accepts the question from a clean tap. The page asks on the first tap after the triangle has been touched; a visitor who only drags gets a small "tap to tilt" button at the top.
- Sound plays even with the phone's ringer on silent; the speaker button is the way to quiet it.
- The tab icon (`site/favicon.svg`) is recoloured to the page's current colours on each bounce.
- Phone motion comes from the browser's `devicemotion` and `deviceorientation` events. They need HTTPS, and an iPhone asks for permission on the first tap, so test on a deployed preview and not on localhost.
- The speaker button turns sound off and on (remembered between visits). It shows on only while sound can be heard: off before the first touch, and off again after the page has been in the background, until the next touch rebuilds the sound.
- Adding `?debug` to the address shows a small readout of what the phone reports (motion permission, sensor readings, sound state), for problems that only show on a real phone.
- The feel is set by the constants at the top of `site/main.mjs`: `ROOM` (gravity, bounce), `HOLD_STIFFNESS` (how closely it follows the hand), `HEFT`, `THEMES` (the colour pairs each bounce steps through).
- `site/_redirects` sends the old site's URLs to the home page.

## Deploy

Cloudflare Pages project `natemcguire-v2`, direct upload from the Mac mini (not Git-triggered):

```sh
python3 deploy.py --preview    # a preview URL
python3 deploy.py              # production
```
