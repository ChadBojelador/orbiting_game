const MAX_PIXEL_RATIO = 1.5;
const MAX_RENDER_PIXELS = 3_000_000;

/** Keeps high-DPI displays from multiplying the full-screen GPU workload. */
export function renderPixelRatio(width: number, height: number, devicePixelRatio: number): number {
  const cssPixels = Math.max(1, width * height);
  const pixelBudgetRatio = Math.sqrt(MAX_RENDER_PIXELS / cssPixels);
  return Math.max(0.5, Math.min(devicePixelRatio, MAX_PIXEL_RATIO, pixelBudgetRatio));
}
