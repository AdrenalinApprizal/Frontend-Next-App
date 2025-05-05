"use client";

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { UserInfo } from "@/components/auth/user-info-provider";

/**
 * Hook to fetch user info from the API
 *
 * Note: This hook must be used within a QueryClientProvider
 * or within a component wrapped by UserInfoProvider
 */
export function useUserInfo(): UseQueryResult<UserInfo> {
  const { data: session, status } = useSession();
  const access_token = session?.access_token as string;

  return useQuery<UserInfo>({
    queryKey: ["userInfo"],
    queryFn: async () => {
      if (!access_token || status !== "authenticated") {
        throw new Error("Not authenticated");
      }

      const response = await fetch("http://localhost:8081/api/auth/user/info", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!access_token && status === "authenticated",
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
