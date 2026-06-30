import { Outlet } from "react-router-dom";

// Minimal, distraction-free shell for the voter ballot (§3, §11). No nav into the admin
// app, no shared chrome — the two designs are meant to dominate.
export function VoterLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="pb-8 pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          A quick preference check · your response is anonymous
        </p>
      </footer>
    </div>
  );
}
