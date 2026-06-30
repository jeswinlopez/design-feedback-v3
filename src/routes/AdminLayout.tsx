import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/Spinner";

export function AdminLayout() {
  const { loading, isAdmin, session, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <FullPageSpinner />;

  // Not signed in, or signed in without an admin profile (seed-only gating): bounce.
  // Preserve the intended destination so login can return the user there.
  if (!session || !isAdmin) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground font-sans font-bold text-sm">
              D
            </span>
            <span className="font-sans font-bold text-lg tracking-tight">Design Face-Off</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-10">
        <Outlet />
      </main>
    </div>
  );
}

