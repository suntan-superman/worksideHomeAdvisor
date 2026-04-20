# Vision Tiers

Last updated: 2026-04-19
Status: active

## Purpose

This document defines which vision workflows are default, which are optional, and which should be treated as experimental.
The goal is to keep Workside focused on marketplace value, speed, and trust instead of spending core product energy on the most failure-prone image edits.

## Tier Definitions

### Core

Core vision is what the product should confidently emphasize in seller-facing flows.
These workflows should be:

- fast
- explainable
- repeatable
- trustworthy
- useful for listing readiness

Core workflows:

- First Impression enhancement
- safe global photo cleanup
- exposure, contrast, white-balance, and clarity improvement
- light decluttering that preserves room truth
- listing-ready selection and packaging
- room/photo quality analysis
- readiness scoring and recommendation generation

Core rules:

- must always return a useful result
- should avoid blank or confusing failure states
- should prefer safe fallback outputs over hard rejection
- should be positioned as listing-readiness help, not fantasy transformation

### Advanced

Advanced vision can create value, but it is not the center of the product promise.
These workflows should be framed as concept previews or optional enhancement tools.

Advanced workflows:

- virtual staging
- furniture removal concepts
- wall-color concepts
- floor-finish concepts
- stronger room-specific enhancement passes
- side-by-side compare and ranked candidate selection

Advanced rules:

- should run only after a stable base image exists
- should be scoped by room understanding and visible-surface confidence
- should return the best safe candidate instead of empty output
- should carry clear quality labels when confidence is below listing-ready

### Experimental

Experimental vision includes workflows that are useful for R&D, diagnostics, or future premium exploration, but are not dependable enough to represent the default system.

Experimental workflows:

- free-form natural-language visual editing
- aggressive repainting and material swaps
- edits that rely on weak or ambiguous surface segmentation
- workflows with frequent spill, structure drift, or long runtimes
- provider/model combinations that are still mainly diagnostic

Experimental rules:

- do not present as default marketplace value
- do not block core seller workflows
- keep behind clear warning language or internal tooling
- use for debugging, provider evaluation, and targeted iteration

## Default Product Posture

The default product posture should be:

1. Core first
2. Advanced second
3. Experimental only when intentionally requested or internally enabled

This means the primary CTA and the clearest UX language should favor:

- first impression wins
- smart enhancement
- listing-ready output

Wall and floor concept edits should not dominate the seller journey, and natural-language vision should not be treated as the main reliability path.

## Pipeline Alignment

### First Impression

Belongs in `Core`.
This should be the fastest, safest, most reliable vision step.

### Smart Enhancement

Mostly `Core`, with some `Advanced` branches.
Its job is to create meaningful improvements without drifting into high-risk transforms by default.

### Listing-Ready Pipeline

Belongs in `Core`.
This is the strictest trust layer and should prefer publishable realism over aggressive transformation.

### Concept Preview Workflows

Belong in `Advanced`.
They can be useful for persuasion and planning, but should be clearly labeled when they are not listing-ready.

### Natural-Language Image Editing

Belongs in `Experimental` until it demonstrates stable, clearly visible, well-contained edits with acceptable runtimes and reliable diagnostics.

## Release Rules

### Allowed As Default

- First Impression
- Enhance for Listing
- light declutter
- lighting improvement
- safe clarity/tone correction
- listing-ready package generation

### Allowed With Clear Framing

- stage room
- remove furniture concept
- try wall color
- try flooring concept

Recommended framing:

- concept preview
- advanced workflow
- may require review

### Not Default

- arbitrary prompt-based room transformations
- strong repainting experiments
- edits with known spill into windows, trim, or ceiling
- workflows that frequently take too long or end in no-result warnings

## Quality Labels

Outputs should be described using product language instead of model/debug language.

Preferred labels:

- `Listing Ready`
- `Safe Enhancement`
- `Concept Preview`
- `Experimental Preview`
- `Needs Review`

Avoid making seller-facing success depend on hidden technical thresholds alone.
When possible, return the best safe candidate and classify it accurately.

## Promotion Criteria

A workflow can move up a tier only when it demonstrates:

- acceptable runtime
- repeatable success on real property photos
- low trust-violation risk
- clear seller value
- debuggable failure behavior

If a workflow is visually impressive but unreliable, it remains advanced or experimental.
