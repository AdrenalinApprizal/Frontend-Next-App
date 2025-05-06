"use client";

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { UserInfo } from "@/components/auth/user-info-provider";
import { api } from "@/utils/api"; // Import the API utility

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

      // Use the API utility instead of direct fetch
      try {
        return await api.get("auth/user/info");
      } catch (error: unknown) {
        // Properly handle the unknown error type
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        throw new Error(`Failed to fetch user info: ${errorMessage}`);
      }
    },
    enabled: !!access_token && status === "authenticated",
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
