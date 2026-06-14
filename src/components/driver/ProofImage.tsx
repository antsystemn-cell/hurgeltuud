import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImageOff, Loader2 } from "lucide-react";

// Renders a proof photo stored in the private "delivery-proofs" bucket by
// resolving a short-lived signed URL from its storage path.
export function ProofImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setError(false);
    supabase.storage
      .from("delivery-proofs")
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err || !data?.signedUrl) setError(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (error) {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-6 text-xs text-muted-foreground">
        <ImageOff className="h-4 w-4" /> Зураг ачааллаагүй
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Баталгаажуулах зураг" className={className} />
    </a>
  );
}
