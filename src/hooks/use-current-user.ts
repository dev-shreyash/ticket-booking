"use client";

import { useCallback, useEffect, useState } from "react";

import type { AuthUser } from "@/modules/auth/auth.types";

type MeResponse = {
  success: boolean;
  user?: AuthUser;
};

export function useCurrentUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = (await response.json()) as MeResponse;

      setUser(data.success && data.user ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    user,
    loading,
    refresh,
  };
}