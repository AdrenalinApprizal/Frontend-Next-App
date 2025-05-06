"use client";

import { createContext, useContext, ReactNode } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
  QueryClientContext,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/utils/api";

export interface UserInfo {
  about_me: string;
  created_at: string;
  email: string;
  first_name: string;
  last_name: string;
  last_login: string;
  phone_number: string;
  profile_picture_url: string;
  status: string;
  user_id: string;
  username: string;
}

// Interface for update profile endpoint
export interface UpdateUserProfileData {
  first_name: string;
  last_name: string;
  phone_number: string;
  about_me: string;
}

interface UserInfoContextType {
  userInfo: UserInfo | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  updateUserProfile: (profileData: UpdateUserProfileData) => Promise<void>;
}

const UserInfoContext = createContext<UserInfoContextType | undefined>(
  undefined
);

// Internal hook for fetching user info
const useUserInfoQuery = () => {
  const { data: session, status } = useSession();
  const access_token = session?.access_token as string;

  return useQuery<UserInfo>({
    queryKey: ["userInfo"],
    queryFn: async () => {
      if (!access_token || status !== "authenticated") {
        throw new Error("Not authenticated");
      }

      try {
        // Use the api utility for consistent error handling
        return await api.get("auth/user/info");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        throw new Error(`Failed to fetch user info: ${errorMessage}`);
      }
    },
    enabled: !!access_token && status === "authenticated",
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
};

export function UserInfoProvider({ children }: { children: ReactNode }) {
  // Create a client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <UserInfoProviderInner>{children}</UserInfoProviderInner>
    </QueryClientProvider>
  );
}

// Inner component that uses the QueryClient
function UserInfoProviderInner({ children }: { children: ReactNode }) {
  const { data: userInfo, isLoading, isError, refetch } = useUserInfoQuery();
  const queryClient = useContext(QueryClientContext);

  // Function to update user profile
  const updateUserProfile = async (profileData: UpdateUserProfileData) => {
    try {
      // Call the API to update profile
      await api.put("users/profile", profileData);

      // After successful update, invalidate the user info query to refetch
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["userInfo"] });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      throw new Error(`Failed to update profile: ${errorMessage}`);
    }
  };

  return (
    <UserInfoContext.Provider
      value={{
        userInfo,
        isLoading,
        isError,
        refetch,
        updateUserProfile,
      }}
    >
      {children}
    </UserInfoContext.Provider>
  );
}

export function useUserInfoContext() {
  const context = useContext(UserInfoContext);
  if (context === undefined) {
    throw new Error(
      "useUserInfoContext must be used within a UserInfoProvider"
    );
  }
  return context;
}
