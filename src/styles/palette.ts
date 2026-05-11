// HSL palette keyed on log₂(rank). Three tuneables walk cool teal (rank 1)
// through magenta to deep red (rank 11) — visual escalation as tiles grow.
// See TD §3.3.
const BASE_HUE = 200;
const HUE_STEP = 14;
const SATURATION = 70;

export function tileColour(value: number): { bg: string; fg: string } {
  const rank = Math.log2(value);
  const hue = (BASE_HUE + rank * HUE_STEP + 360) % 360;
  // Lightness 82% at rank 1, drops 5%/rank, floored at 30% past rank ~11.
  const lightness = Math.max(30, 82 - (rank - 1) * 5);
  return {
    bg: `hsl(${hue} ${SATURATION}% ${lightness}%)`,
    // Dark text on light tiles, white text on dark — threshold lowered to 52
    // for safe contrast on mid-rank magenta/red.
    fg: lightness > 52 ? 'hsl(210 60% 18%)' : 'hsl(0 0% 100%)',
  };
}
