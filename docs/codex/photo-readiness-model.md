# Photo Readiness Model

## Four separate metrics
The renderer now separates:
1. `totalSelectedPhotos`
2. `marketplaceReadyPhotos`
3. `savedPhotosFlaggedForImprovement`
4. `priorityRetakes` and `mustFixBeforeLaunchCount`

## Why this matters
- Near-ready properties can have a real buyer-facing gallery while still carrying retake backlog.
- Low-readiness properties with zero ready photos stay gated in preview mode.

## Applied surfaces
- Seller photo dashboard metric cards
- Output-class selection
- Section gating (prep page vs gallery-heavy pages)
- Flyer gallery inclusion logic
