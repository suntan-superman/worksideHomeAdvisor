# Flyer CTA Strategy

Flyers now include structured CTA metadata:

- `flyer.ctaMetadata.strategy`
- `flyer.ctaMetadata.label`
- `flyer.ctaMetadata.destinationType`
- `flyer.ctaMetadata.destinationRoute`
- `flyer.ctaMetadata.relatedPropertyId`
- `flyer.ctaMetadata.priority`
- `flyer.ctaMetadata.trackingKey`

Strategy is selected by mode and context:

- `preview` -> property packet / learn-more style CTA
- `launch_ready` -> showing request CTA
- `premium` -> private-showing/contact CTA

Rendered CTA text follows:

1. user customization (if provided)
2. mode-specific CTA
3. fallback CTA label

PDF templates now read CTA labels from flyer metadata so copy stays consistent across surfaces.

