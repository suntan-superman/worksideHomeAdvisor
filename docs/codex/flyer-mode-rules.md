# Flyer Mode Rules

Flyers now carry:

- `flyer.mode` (`preview`, `launch_ready`, `premium`)
- `flyer.modeLabel`
- `flyer.readinessScore`
- `flyer.readinessSignals`

Mode selection uses photo readiness signals:

- Quality score average
- Marketplace-ready photo count
- Preferred variant count
- Weak-photo count
- Room diversity

Thresholds:

- `premium`: high readiness score + strong quality + strong marketplace-ready coverage
- `launch_ready`: moderate-to-strong readiness with adequate photo quality
- `preview`: low readiness or weak photo quality

Mode effects:

- Adjust subheadline tone
- Adjust summary tone
- Adjust CTA strategy and label
- Prevent preview properties from being framed as fully polished

