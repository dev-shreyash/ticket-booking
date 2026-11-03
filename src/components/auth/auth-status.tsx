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

export default function AuthStatus() {
  const router = useRouter();
  const pathname = usePathname();

  const { user, loading, refresh } = useCurrentUser();

  const [loggingOut, setLoggingOut] = useState(false);

  // Keep the latest refresh function without triggering unnecessary effects.
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // Recheck authentication after navigation and when returning to the tab.
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

      await refresh();

      toast.success("Logged out successfully.");

      router.refresh();
    } catch {
      toast.error("Unable to log out.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-zinc-500">
        Checking authentication...
      </p>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">
          Signed in
        </p>

        <p className="text-sm text-zinc-400">
          {user.name || user.email || user.phone || "Customer"}
        </p>

        <p className="text-xs uppercase tracking-wider text-zinc-500">
          {user.role}
        </p>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {loggingOut ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}