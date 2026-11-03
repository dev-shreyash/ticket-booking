
"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCurrentUser } from "@/hooks/use-current-user";

type ApiResponse = {
  success: boolean;
  message?: string;
};

export default function CatalogueNav() {
  const router = useRouter();
  const pathname = usePathname();

  const { user, loading, refresh } = useCurrentUser();

  const [loggingOut, setLoggingOut] = useState(false);

  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // Refresh authentication after navigation and when returning to the tab.
  useEffect(() => {
    void refreshRef.current();

    function handleFocus() {
      void refreshRef.current();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        toast.error(data.message ?? "Logout failed.");
        return;
      }

      toast.success("Logged out successfully.");

      // Update the client-side authentication state.
      void refresh().catch(() => undefined);

      // Redirect to the public homepage.
      router.replace("/");
    } catch {
      toast.error("Unable to log out.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link
          href="/"
          className="shrink-0 text-base font-bold tracking-tight text-white"
        >
          Movie<span className="text-zinc-400">Booking</span>
        </Link>

        <div className="flex items-center gap-4 text-sm text-zinc-300 sm:gap-6">
          <Link
            href="/movies"
            className="transition hover:text-white"
          >
            Movies
          </Link>

          <Link
            href="/theatres"
            className="transition hover:text-white"
          >
            Theatres
          </Link>

          {loading ? (
            <span className="text-xs text-zinc-500">
              Checking...
            </span>
          ) : user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/bookings"
                className="transition hover:text-white"
              >
                My bookings
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-white transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          ) : (
           <Link
  href={`/login?returnTo=${encodeURIComponent(pathname || "/")}`}
  className="rounded-lg border border-zinc-700 px-3 py-2 transition hover:border-zinc-500 hover:text-white"
>
  Sign in
</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
