"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { MeResponse } from "@/lib/api/types";

export function useCurrentUser(initialMe: MeResponse | null = null) {
  const [me, setMe] = useState<MeResponse | null>(initialMe);
  const [isLoadingUser, setIsLoadingUser] = useState(initialMe === null);

  async function loadUser() {
    try {
      return await apiFetch<MeResponse>("/me");
    } catch {
      return null;
    }
  }

  const refreshUser = useCallback(async () => {
    setIsLoadingUser(true);

    const response = await loadUser();
    setMe(response);
    setIsLoadingUser(false);
  }, []);

  useEffect(() => {
    if (initialMe) {
      return;
    }

    let isMounted = true;

    async function loadInitialUser() {
      const response = await loadUser();

      if (!isMounted) {
        return;
      }

      setMe(response);
      setIsLoadingUser(false);
    }

    void loadInitialUser();

    return () => {
      isMounted = false;
    };
  }, [initialMe]);

  return {
    me,
    user: me?.user ?? null,
    isLoadingUser,
    refreshUser,
  };
}
