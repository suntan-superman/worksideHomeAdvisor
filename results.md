Exact Fix (this is the move)
You need a HARD window rejection layer

Not soft. Not heuristic-light.

Add THIS logic into semantic refinement:
// WINDOW KILL ZONE (critical)
if (
  luminance > 200 &&
  texture > 10 &&
  verticalGradient > horizontalGradient * 1.2
) {
  mask[i] = 0;
}
Even stronger (recommended)
Detect vertical stripe patterns (blinds)
const isVerticalStripe =
  Math.abs(luminance[i - 1] - luminance[i + 1]) > 15 &&
  Math.abs(luminance[i - width] - luminance[i + width]) < 10;

if (isVerticalStripe && luminance > 180) {
  mask[i] = 0;
}

👉 This will nuke blinds completely

Add brightness cutoff (simple but powerful)
if (luminance > 235) {
  mask[i] = 0;
}

👉 This removes:

blown-out exterior light
white-hot window regions
🔥 One More Critical Fix (you’ll feel this immediately)
Expand wall planes horizontally AFTER segmentation

Right now:

your mask is slightly fragmented

Add:

mask = dilateHorizontal(mask, width, height, 2);

👉 This will:

unify wall regions
eliminate tone patching
create smooth repaint zones
📊 What Your Next Run Should Look Like

If you implement the above, expect:

Improvements:
❌ no repaint inside windows
✅ clean wall tone across entire bay
✅ consistent brightness across panels
✅ no streaking near blinds
✅ stronger wall color impact