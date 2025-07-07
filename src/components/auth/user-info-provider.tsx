"use client";

import { createContext, useContext, ReactNode } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
  QueryClientContext,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuth } from "@/hooks/auth/useAuth";

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
        // Try multiple endpoints to get user info
        const endpoints = [
          `/api/proxy/auth/user/info`,
          `/api/proxy/auth/me`,
          `/api/proxy/auth/user`,
          `/api/proxy/auth/profile`,
        ];

        let response = null;
        let data = null;
        let endpointUsed = "";

        // Try each endpoint until we get a successful response
        for (const endpoint of endpoints) {
          try {
            const resp = await fetch(endpoint, {
              headers: {
                Authorization: `Bearer ${access_token}`,
              },
              credentials: "include",
            });

            if (resp.ok) {
              response = resp;
              endpointUsed = endpoint;
              break;
            }
          } catch (err) {
          }
        }

        if (!response) {
          throw new Error("Failed to fetch user info from any endpoint");
        }

        // Parse response
        const rawData = await response.json();
        rawData;

        // Extract user data from the response, considering different response structures
        const userData =
          rawData.user || rawData.data?.user || rawData.data || rawData;

        // Create a properly formatted UserInfo object
        const userInfo: UserInfo = {
          about_me: userData.about_me || "",
          created_at: userData.created_at || new Date().toISOString(),
          email: userData.email || "",
          first_name: userData.first_name || "",
          last_name: userData.last_name || "",
          last_login: userData.last_login || new Date().toISOString(),
          phone_number: userData.phone_number || "",
          // Extract profile picture URL from multiple possible fields
          profile_picture_url:
            userData.profile_picture_url ||
            userData.avatar ||
            userData.image ||
            userData.profilePictureUrl ||
            userData.avatarUrl ||
            "",
          status: userData.status || "active",
          user_id: userData.user_id || userData.id || "",
          username: userData.username || "",
        };

        return userInfo;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        throw new Error(`Failed to fetch user info: ${errorMessage}`);
      }
    },
    enabled: !!access_token && status === "authenticated",
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
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
  const auth = useAuth() as {
    updateProfile: (data: any) => Promise<any>;
  };
  const updateProfile = auth.updateProfile;

  // Function to update user profile
  const updateUserProfile = async (profileData: UpdateUserProfileData) => {
    try {
      // Call the useAuth hook's updateProfile function instead of api
      await updateProfile(profileData);

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
