import { useEffect, useRef, useState } from "react";
import { ImagePlus, Lock } from "lucide-react";
import type { Variant } from "@/lib/types";
import { UPLOAD } from "@/lib/config";
import { getSignedUrl, updateVariant, uploadVariantImage } from "./api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function VariantUploader({
  testId,
  variant,
  locked,
  onChange,
}: {
  testId: string;
  variant: Variant;
  locked: boolean;
  onChange: () => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState(variant.caption ?? "");

  useEffect(() => {
    let active = true;
    if (variant.image_path) {
      getSignedUrl(variant.image_path).then((u) => active && setPreview(u));
    } else {
      setPreview(null);
    }
    return () => {
      active = false;
    };
  }, [variant.image_path]);

  async function handleFile(file: File) {
    if (!UPLOAD.acceptedTypes.includes(file.type as (typeof UPLOAD.acceptedTypes)[number])) {
      toast({ variant: "error", title: "Unsupported file", description: "Use PNG, JPG, or WebP." });
      return;
    }
    if (file.size > UPLOAD.maxBytes) {
      toast({ variant: "error", title: "File too large", description: "Max ~10MB." });
      return;
    }
    setBusy(true);
    try {
      await uploadVariantImage(testId, variant, file);
      onChange();
      toast({ variant: "success", title: `Variant ${variant.label} uploaded` });
    } catch (e) {
      toast({ variant: "error", title: "Upload failed", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function saveCaption() {
    if (caption === (variant.caption ?? "")) return;
    try {
      await updateVariant(variant.id, { caption: caption.trim() || null });
      onChange();
    } catch (e) {
      toast({ variant: "error", title: "Couldn’t save caption", description: (e as Error).message });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Variant {variant.label}</Label>
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> Locked
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={locked || busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-secondary/40 transition-colors",
          !locked && "hover:border-accent hover:bg-secondary/70",
          locked && "cursor-not-allowed opacity-90",
        )}
      >
        {preview ? (
          <img src={preview} alt={`Variant ${variant.label}`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {busy ? <Spinner className="size-5" /> : <ImagePlus className="size-6" />}
            <span className="text-sm">{busy ? "Uploading…" : "Upload design"}</span>
            <span className="text-xs">PNG · JPG · WebP · ≤10MB</span>
          </div>
        )}
        {preview && !locked && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-1.5 text-center text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
            Replace
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD.acceptAttr}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="space-y-1.5">
        <Label htmlFor={`caption-${variant.id}`} className="text-xs text-muted-foreground">
          Caption (optional)
        </Label>
        <Input
          id={`caption-${variant.id}`}
          value={caption}
          disabled={locked}
          placeholder="e.g. Bolder hero, single CTA"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
        />
      </div>
    </div>
  );
}
