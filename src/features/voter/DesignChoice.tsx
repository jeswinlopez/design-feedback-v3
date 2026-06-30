import { useState } from "react";
import { Maximize2, ImageOff } from "lucide-react";
import type { BallotVariant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// One design presented as a hero. Tap the image to enlarge; one clear "Choose this".
// We intentionally do NOT show the A/B label to the voter — only position matters.
export function DesignChoice({
  variant,
  position,
  onChoose,
}: {
  variant: BallotVariant;
  position: number;
  onChoose: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => variant.url && setOpen(true)}
        className="group relative aspect-[4/3] w-full overflow-hidden bg-secondary/40"
        aria-label="Enlarge design"
      >
        {variant.url ? (
          <>
            <img
              src={variant.url}
              alt={`Design option ${position + 1}`}
              className="h-full w-full object-contain"
            />
            <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-foreground/60 text-background opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="size-4" />
            </span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="size-6" />
            <span className="text-sm">Image unavailable</span>
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {variant.caption && <p className="text-sm text-muted-foreground">{variant.caption}</p>}
        <Button variant="accent" size="lg" className="mt-auto w-full" onClick={onChoose}>
          Choose this
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
          {variant.url && (
            <img
              src={variant.url}
              alt={`Design option ${position + 1} enlarged`}
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
