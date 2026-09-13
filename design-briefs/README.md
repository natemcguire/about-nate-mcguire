# Nate McGuire: facts fixed, design wide open

## Current direction — round 2

Give each model ONLY `shared-prompt.md`, its named brief, and `../next/content.json`.
Ask for five new, badass websites with their own HTML, CSS, JavaScript, typography,
layout, animation, and interaction. JSON supplies facts; it is not a visual reference.
Do not attach the base site's HTML or CSS. Do not require quoted field labels, braces,
JSON links, a shared DOM, or a shared stylesheet. Five complete websites per model.

The plain structured profile in `next/` remains the default site. Model-generated designs
are independent experiences selected from a reviewed cache, not themes for that profile.

## Content

Use the concise facts and contact destinations in `next/content.json`. Models can rewrite
phrasing and reorganize content while preserving meaning. Staff Engineer at Capital One,
Card Tech; Alexandria, Virginia. Google, Airbnb, and IBM were Mayven clients. No invented
projects, awards, claims, numbers, availability, or workflow commentary inside the websites.

## Sitemap

- `/`: default structured profile with top model-selection controls when designs are ready.
- `/content.json`: canonical factual source.
- Approved self-contained design documents: cached assets selected by the outer site shell.
- External contact/writing links keep their destinations from the JSON.

The default page owns indexable metadata and canonical URL. Variations must not become
competing indexable copies. Keep Source/reset and model switching in the outer shell,
outside each generated website. Before release, replace the old CSS-switching runtime
with a sandboxed document player that supports independent HTML and JS. Retain public
access to the plain readable profile if a candidate fails to load.

Proposed legacy consolidation: `/about`, `/speaking`, `/work-with-me` to `/`; decide article
archive retention with Nate before publishing redirects. Existing v2/v3 material is intact.

## Batches and provenance

- `candidates/` and http://localhost:8766: first round, constrained CSS themes (superseded).
- `candidates-round2/`: independent websites from the corrected brief.
- `review-round2/` and http://localhost:8767: second-round review gallery.

Preserve raw prompts/responses and actual model identities. Never relabel one provider's
output as another's. Gemini through AGY records the requested model from the authenticated
catalog; if the transport cannot attest the serving model, say so in provenance.

## Review and publish

1. Save complete standalone HTML, inline CSS/JS, and submission metadata under
   `candidates-round2/<model>/<id>/index.html`.
2. Build the gallery with `python3 design-briefs/build_review_round2.py` and serve
   `design-briefs/review-round2` on port 8767. Gallery notes stay outside website previews.
3. Check factual completeness, links, genuinely distinct layouts, interactions, readability,
   responsive behavior, reduced motion, keyboard access, and executable code.
4. Nate and the reviewing agent approve each design before it enters the public catalog.
   Shortlists are comparison aids, saved locally in the browser. They are NOT approval.
5. Publish only selected reviewed assets. Random selection stays within the chosen model's
   approved pool and avoids immediate repeats. Record exact model/version/date in metadata.
6. Review again when content changes; record content version in the approval metadata.

Public controls should feel quick and expressive, but must not falsely claim a live model
request. No internal approval status, generation commentary, or developer instructions
inside generated websites. No live model API or secret is needed for public viewing.

All candidates are local-only until approved. No deployment has occurred.
