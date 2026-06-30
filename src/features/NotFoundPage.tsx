import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-sans font-bold text-5xl">404</p>
      <p className="mt-3 text-muted-foreground">This page doesn’t exist.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/admin">Back to dashboard</Link>
      </Button>
    </div>
  );
}
