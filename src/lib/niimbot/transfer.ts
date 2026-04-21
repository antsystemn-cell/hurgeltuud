/** Trigger a browser download for a generated Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click handler has had a chance to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Try to share a file via the Web Share API. Returns false if unsupported
 * or if the user cancelled — caller should fall back to download.
 */
export async function shareBlob(
  blob: Blob,
  filename: string,
  title: string,
): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (!nav.share || !nav.canShare || !nav.canShare({ files: [file] })) {
    return false;
  }
  try {
    await nav.share({ files: [file], title });
    return true;
  } catch (err) {
    // AbortError = user cancelled, treat as handled
    if ((err as DOMException)?.name === "AbortError") return true;
    return false;
  }
}

export type Platform = "android" | "ios" | "desktop";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

export function isWebShareFilesSupported(): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (!nav.canShare) return false;
  try {
    const probe = new File([new Blob(["x"])], "p.txt", { type: "text/plain" });
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
