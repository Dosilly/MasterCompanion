const viewportMargin = 8;

export function contextMenuPosition(
  anchor: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): { x: number; y: number } {
  return {
    x: Math.max(viewportMargin, Math.min(anchor.x, viewport.width - size.width - viewportMargin)),
    y: Math.max(viewportMargin, Math.min(anchor.y, viewport.height - size.height - viewportMargin)),
  };
}
