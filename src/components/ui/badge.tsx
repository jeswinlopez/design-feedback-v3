import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        accent: "border-accent/15 bg-accent-soft text-accent",
        success: "border-success/15 bg-success/10 text-success",
        muted: "border-transparent bg-muted text-muted-foreground",
        warning: "border-amber-200/70 bg-amber-50 text-amber-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
