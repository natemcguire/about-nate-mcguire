# Production release

Cloudflare Pages project `natemcguire-v2`, production branch `main`, domain natemcguire.com.
Git source branch is `master`; Pages is direct upload, not Git-triggered.

Build: `python3 next/build.py && python3 release/build.py`.
Stage `release/` on the Mac mini in a separate timestamped directory; run `python3 deploy.py <git-sha>`.
The deploy script uses existing account credentials privately and the Mini's ARM Wrangler.
Existing TLDR function, KV binding, remote secrets, and writing URLs are preserved.
Generated assets/functions/config are ignored here; the build regenerates them from source.

Nate approved the complete second-round collection with “i like it, launch” on 2026-09-13.
Agent content/code review approved all twenty after documented candidate corrections.
Public catalog: `next/designs/manifest.json`; no gallery, prompts, raw model responses,
review controls, or generation scripts are included in site/.

Pre-launch rollback deployment: 34bf651d-b888-4e1b-980a-390dad46838d.
