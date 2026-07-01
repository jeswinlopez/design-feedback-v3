import { useState } from "react";
import { Maximize2, ImageOff, RotateCw } from "lucide-react";
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
  // Signed Storage URLs are short-lived; if one expires while the voter lingers, the
  // <img> errors. Track that so we can show a reload affordance instead of a broken icon.
  const [broken, setBroken] = useState(false);
  const showImage = !!variant.url && !broken;

  return (
    <div className="group/card flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lift">
      <button
        type="button"
        onClick={() => showImage && setOpen(true)}
        className="group relative aspect-[4/3] w-full overflow-hidden bg-secondary/50"
        aria-label="Enlarge design"
      >
        {showImage ? (
          <>
            <img
              src={variant.url!}
              alt={`Design option ${position + 1}`}
              onError={() => setBroken(true)}
              className="h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.015]"
            />
            <span className="absolute left-3 top-3 grid h-7 min-w-7 place-items-center rounded-full bg-background/85 px-2 text-xs font-semibold text-foreground shadow-xs backdrop-blur">
              {position + 1}
            </span>
            <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-foreground/55 text-background opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <Maximize2 className="size-4" />
            </span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <ImageOff className="size-6" />
            <span className="text-sm">{broken ? "Image expired" : "Image unavailable"}</span>
            {broken && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.reload();
                }}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <RotateCw className="size-3.5" /> Reload
              </button>
            )}
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        {variant.caption && (
          <p className="text-sm leading-relaxed text-muted-foreground">{variant.caption}</p>
        )}
        <Button variant="accent" size="lg" className="mt-auto w-full" onClick={onChoose}>
          Choose this
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
          {showImage && (
            <img
              src={variant.url!}
              alt={`Design option ${position + 1} enlarged`}
              onError={() => {
                setBroken(true);
                setOpen(false);
              }}
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
