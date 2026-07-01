import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/ui/toast";
import { queryClient } from "./lib/queryClient";
import { supabaseConfigured } from "./lib/supabase";
import "./index.css";

function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-sans font-bold text-2xl tracking-tight">Configuration missing</h1>
        <p className="mt-3 text-muted-foreground">
          This deployment is missing its Supabase environment variables
          (<code className="text-sm">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-sm">VITE_SUPABASE_ANON_KEY</code>). Set them and redeploy.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {supabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    ) : (
      <ConfigError />
    )}
  </React.StrictMode>,
);
