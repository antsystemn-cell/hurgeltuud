import { toPng } from "html-to-image";

/**
 * Render an HTML element (the existing 70×80mm sticker preview)
 * into a high-DPI PNG suitable for Niimbot app's "Print image".
 */
export async function generateLabelPng(
  element: HTMLElement,
  filenameSafeOrderNo: string,
): Promise<{ blob: Blob; filename: string }> {
  // 70mm × 80mm at ~12 px/mm ≈ 840×960 — sharp on 203dpi printers
  const dataUrl = await toPng(element, {
    pixelRatio: 4,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return {
    blob,
    filename: `niimbot-label-${filenameSafeOrderNo}.png`,
  };
}
