function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sum(widths: number[]): number {
  let total = 0;
  for (let i = 0; i < widths.length; i += 1) total += widths[i];
  return total;
}

export interface FitColumnWidthsOptions {
  widths: number[];
  viewportWidth: number;
  rowHeaderWidth: number;
  minWidth: number;
  maxWidth: number;
}

export function fitColumnWidthsToViewport({
  widths,
  viewportWidth,
  rowHeaderWidth,
  minWidth,
  maxWidth,
}: FitColumnWidthsOptions): number[] {
  if (widths.length === 0) return [];

  const baseWidths = widths.map((width) => clamp(width, minWidth, maxWidth));
  if (!Number.isFinite(viewportWidth) || viewportWidth <= rowHeaderWidth) return baseWidths;

  const availableWidth = viewportWidth - rowHeaderWidth;
  const minTotal = minWidth * widths.length;
  const maxTotal = maxWidth * widths.length;
  if (availableWidth <= minTotal) return widths.map(() => minWidth);
  if (availableWidth >= maxTotal) return widths.map(() => maxWidth);

  const baseTotal = sum(baseWidths);
  if (baseTotal <= 0 || Math.abs(baseTotal - availableWidth) < 0.001) return baseWidths;

  const result = new Array(widths.length).fill(0);
  const active = new Set<number>(widths.map((_, index) => index));
  let remainingWidth = availableWidth;
  let remainingBaseTotal = baseTotal;

  while (active.size > 0) {
    let changed = false;

    for (const index of Array.from(active)) {
      const proposed = remainingBaseTotal > 0
        ? remainingWidth * (baseWidths[index] / remainingBaseTotal)
        : remainingWidth / active.size;

      if (proposed <= minWidth) {
        result[index] = minWidth;
        remainingWidth -= minWidth;
        remainingBaseTotal -= baseWidths[index];
        active.delete(index);
        changed = true;
        continue;
      }

      if (proposed >= maxWidth) {
        result[index] = maxWidth;
        remainingWidth -= maxWidth;
        remainingBaseTotal -= baseWidths[index];
        active.delete(index);
        changed = true;
      }
    }

    if (!changed) break;
  }

  if (active.size === 0) return result;

  const remainingIndices = Array.from(active);
  const shareBaseTotal = remainingBaseTotal > 0 ? remainingBaseTotal : remainingIndices.length;
  for (const index of remainingIndices) {
    const width = remainingBaseTotal > 0
      ? remainingWidth * (baseWidths[index] / shareBaseTotal)
      : remainingWidth / remainingIndices.length;
    result[index] = clamp(width, minWidth, maxWidth);
  }

  return result;
}
