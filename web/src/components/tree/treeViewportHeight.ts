/** The height may shrink below a card when upstream content leaves little reading space. */
export function availableTreeViewportHeight(top: number, navTop: number): number {
  return Math.max(0, Math.floor(navTop - top - 16));
}
