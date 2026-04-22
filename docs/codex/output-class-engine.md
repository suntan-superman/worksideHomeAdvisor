# Output Class Engine

## Purpose
Select seller-report and flyer output classes from property state before rendering pages.

## Inputs
- `readinessScore`
- `marketplaceReadyPhotoCount`
- `chosenPricePresent`
- `checklistCompletionPercent`
- `priorityRetakeCount`

## Classes
- Seller report: `prep_report`, `balanced_report`, `launch_report`
- Flyer: `preview_flyer`, `prelaunch_flyer`, `marketing_flyer`

## Core rules
- If readiness `< 50` or marketplace-ready photos `== 0`: `prep_report` + `preview_flyer`
- If readiness `50-69`: `balanced_report` + `prelaunch_flyer`
- If readiness `>= 70` and ready photos `>= 3` and chosen price exists: `launch_report` + `marketing_flyer`
- High-readiness + weak-gallery mismatch is downgraded to balanced/prelaunch.

## Logging
PDF generation logs:
- selected classes
- reason codes (for validation and regression audits)
