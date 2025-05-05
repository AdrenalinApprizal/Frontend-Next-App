import { getSession, signIn } from "next-auth/react";

/**
 * Checks if the current token needs to be refreshed and handles the refresh if needed
 * @returns {Promise<boolean>} true if refresh succeeded or wasn't needed, false if failed
 */
export async function checkAndRefreshToken(): Promise<boolean> {
  try {
    const session = await getSession();

    if (!session) {
      return false;
    }

    // Check if token exists and has expiration time
    if (!session.access_token || !session.expiresAt) {
      return false;
    }

    // Parse the expiration time
    const expiryTime = new Date(session.expiresAt).getTime();
    const currentTime = new Date().getTime();

    // If token is expired or about to expire (within 5 minutes), refresh it
    if (expiryTime - currentTime < 5 * 60 * 1000) {
      // Try to refresh the token
      try {
        const refreshResult = await fetch(
          "http://localhost:8081/api/auth/refresh",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!refreshResult.ok) {
          // If refresh fails, user must log in again
          await signIn();
          return false;
        }

        // Process the response and get the new token
        const refreshData = await refreshResult.json();

        // If you need to update the session with the new token,
        // you may need to call the custom endpoint that updates the session
        // This would normally be handled by NextAuth callbacks

        return true;
      } catch (error) {
        console.error("Token refresh error:", error);
        return false;
      }
    }

    // Token is still valid
    return true;
  } catch (error) {
    console.error("Token check error:", error);
    return false;
  }
}
