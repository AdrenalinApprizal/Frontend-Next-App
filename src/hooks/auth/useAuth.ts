import { getSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

// Define user type
interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  about_me?: string;
  profile_picture_url?: string;
}

// Define registration data interface
interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  about_me?: string;
  profile_picture_url?: string;
}

// Define profile update interface
interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  about_me?: string;
}

// Define password change interface
interface PasswordChangeData {
  current_password: string;
  new_password: string;
}

// Define response interface
interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  status?: number;
  statusText?: string;
}

// Cookie config
const COOKIE_TOKEN_KEY = "auth_token";
const COOKIE_OPTIONS = {
  expires: 7, // 7 days
  path: "/",
  secure: process.env.NODE_ENV !== "development",
  sameSite: "lax" as const,
};

/**
 * Custom hook for authentication
 */
export const useAuth = () => {
  // State declarations
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Other hooks
  const router = useRouter();

  // Base URLs
  const proxyUrl = "/api/proxy";
  const API_BASE_URL = "/api/proxy";

  // Computed values
  const isAuthenticated = !!user;

  // Function to get auth headers
  function getAuthHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  // Set token in cookie
  function setTokenCookie(tokenValue: string) {
    if (typeof window === "undefined") return;
    Cookies.set(COOKIE_TOKEN_KEY, tokenValue, COOKIE_OPTIONS);
  }

  // Get token from cookie
  function getTokenFromCookie(): string | null {
    if (typeof window === "undefined") return null;
    return Cookies.get(COOKIE_TOKEN_KEY) || null;
  }

  // Remove token from cookie
  function removeTokenCookie() {
    if (typeof window === "undefined") return;
    Cookies.remove(COOKIE_TOKEN_KEY);
  }

  // Update avatar
  async function updateAvatar(fileOrBase64: File | string) {
    try {
      const session = await getSession();
      const currentToken =
        session?.access_token || token || getTokenFromCookie();

      if (!currentToken) {
        throw new Error("No authentication token available");
      }

      // Check if input is a base64 string
      if (
        typeof fileOrBase64 === "string" &&
        fileOrBase64.startsWith("data:")
      ) {
        console.log("[DEBUG] Updating avatar with base64 string");

        // Direct upload to profile avatar endpoint
        const avatarEndpoint = `${proxyUrl}/users/profile/avatar`;
        const avatarResponse = await fetch(avatarEndpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ profile_picture_url: fileOrBase64 }),
          credentials: "include",
        });

        if (!avatarResponse.ok) {
          const errorText = await avatarResponse.text();
          throw new Error(`Avatar update failed: ${errorText}`);
        }

        // Return the updated profile data
        const data = await avatarResponse.json();
        return data;
      }
      // Handle File object
      else if (fileOrBase64 instanceof File) {
        const file = fileOrBase64;
        console.log("[DEBUG] Updating avatar with file:", file.name);

        // The rest of your implementation...
        return { success: true, profile_picture_url: "example_url" };
      }
    } catch (error: any) {
      console.error("[DEBUG] Avatar update error:", error);
      if (
        error.name === "TypeError" &&
        error.message.includes("Failed to fetch")
      ) {
        throw new Error(
          "Connection to server failed. Please check if the server is running."
        );
      }
      throw new Error(error?.message || "Failed to update avatar");
    }
  }

  // Update profile
  async function updateProfile(data: ProfileUpdateData) {
    try {
      const session = await getSession();
      const currentToken =
        session?.access_token || token || getTokenFromCookie();

      if (!currentToken) {
        throw new Error("No authentication token available");
      }

      console.log("wkwkwk", `${API_BASE_URL}/users/profile`);

      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DEBUG] Profile update failed:", errorText);
        throw new Error(
          `Profile update failed: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      console.log("[DEBUG] Profile update successful:", result);

      return result;
    } catch (error: any) {
      console.error("[DEBUG] Profile update error:", error);
      throw error;
    }
  }

  // Change password
  async function changePassword(data: PasswordChangeData) {
    try {
      const session = await getSession();
      const currentToken =
        session?.access_token || token || getTokenFromCookie();

      if (!currentToken) {
        throw new Error("No authentication token available");
      }

      console.log("[DEBUG] Changing password");

      const response = await fetch(`${API_BASE_URL}/users/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DEBUG] Password change failed:", errorText);
        throw new Error(
          `Password change failed: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      console.log("[DEBUG] Password change successful:", result);

      return result;
    } catch (error: any) {
      console.error("[DEBUG] Password change error:", error);
      throw error;
    }
  }

  // Handle auth error
  function handleAuthError(error: any) {
    // Implementation here
  }

  // Check server connectivity
  async function checkServerConnectivity() {
    // Implementation here
    return { success: true };
  }

  // Get user info
  async function getUserInfo() {
    try {
      const session = await getSession();
      const currentToken =
        session?.access_token || token || getTokenFromCookie();

      if (!currentToken) {
        throw new Error("No authentication token available");
      }

      console.log("[DEBUG] Getting user info");

      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DEBUG] Get user info failed:", errorText);
        throw new Error(
          `Get user info failed: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      console.log("[DEBUG] Get user info successful:", result);

      return result;
    } catch (error: any) {
      console.error("[DEBUG] Get user info error:", error);
      throw error;
    }
  }

  // Export all the functions
  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    getUserInfo,
    checkServerConnectivity,
    updateProfile,
    updateAvatar,
    changePassword,
    handleAuthError,
    isConnecting,
    connectionError,
  };
};
