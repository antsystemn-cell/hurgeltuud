import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  downloadBlob,
  isWebShareFilesSupported,
  shareBlob,
} from "@/lib/niimbot/transfer";
import { generateLabelPng } from "@/lib/niimbot/png";
import { NiimbotInstructionsModal } from "./NiimbotInstructionsModal";

interface Props {
  /** Get the DOM node holding the rendered sticker preview */
  getPreviewElement: () => HTMLElement | null;
  /** Used to build the filename, e.g. order number */
  filenameSafeId: string;
}

/**
 * Per-order Niimbot print button:
 * - Generates a high-DPI PNG of the existing sticker preview
 * - Shares via Web Share API on supported devices, falls back to download
 * For bulk Excel export use the dedicated Excel button on the page.
 */
export function NiimbotPrintButton({ getPreviewElement, filenameSafeId }: Props) {
  const [busy, setBusy] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const canShareFiles = isWebShareFilesSupported();

  async function build() {
    const el = getPreviewElement();
    if (!el) {
      toast.error("Шошгоны preview олдсонгүй");
      return null;
    }
    return generateLabelPng(el, filenameSafeId);
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const result = await build();
      if (!result) return;
      downloadBlob(result.blob, result.filename);
      toast.success("PNG файл татагдлаа");
      setShowInstructions(true);
    } catch (e) {
      console.error(e);
      toast.error("Зураг үүсгэхэд алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      const result = await build();
      if (!result) return;
      const shared = await shareBlob(result.blob, result.filename, "Niimbot шошго");
      if (shared) {
        toast.success("Хуваалцах цонх нээгдлээ");
      } else {
        downloadBlob(result.blob, result.filename);
        toast.success("PNG файл татагдлаа");
        setShowInstructions(true);
      }
    } catch (e) {
      console.error(e);
      toast.error("Файл үүсгэхэд алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Button
          onClick={handleDownload}
          disabled={busy}
          className="flex-1"
          variant="outline"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4 mr-2" />
          )}
          PNG татах
        </Button>
        {canShareFiles && (
          <Button onClick={handleShare} disabled={busy} className="flex-1">
            <Share2 className="h-4 w-4 mr-2" />
            Niimbot руу илгээх
          </Button>
        )}
      </div>

      <NiimbotInstructionsModal
        open={showInstructions}
        onOpenChange={setShowInstructions}
        mode="png"
      />
    </>
  );
}

interface BulkProps {
  onExport: () => Promise<void> | void;
  count: number;
  disabled?: boolean;
}

/** Bulk Excel export trigger for the "Import Data Source" Niimbot flow */
export function NiimbotBulkXlsxButton({ onExport, count, disabled }: BulkProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await onExport();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={busy || disabled || count === 0}
      className="w-full"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Excel татах ({count})
    </Button>
  );
}
